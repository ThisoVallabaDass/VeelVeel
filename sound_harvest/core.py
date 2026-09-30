from __future__ import annotations

import csv
import hashlib
import json
import logging
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

import numpy as np
import soundfile as sf
import yaml
from scipy.signal import find_peaks

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LABEL_COLUMNS = ["clip_id", "keep", "title", "title_ta", "category", "kind", "profile", "difficulty", "funny", "region", "notes", "status"]
CLIP_COLUMNS = ["clip_id", "wav_path", "ogg_path", "source_url", "video_id", "playlist_ids", "video_title", "uploader", "upload_date", "start_s", "end_s", "duration_ms", "sample_rate", "channels", "orig_peak_db", "gain_db", "rms_db", "content_sha1", "flags", "split_config_hash"]


def setup_logging() -> logging.Logger:
    log_dir = DATA / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    logger = logging.getLogger("sound_harvest")
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        fmt = logging.Formatter("%(asctime)s %(levelname)s %(message)s")
        logger.addHandler(logging.StreamHandler())
        logger.addHandler(logging.FileHandler(log_dir / f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}.log", encoding="utf-8"))
        for handler in logger.handlers:
            handler.setFormatter(fmt)
    return logger


def append_jsonl(path: Path, item: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(item, ensure_ascii=False) + "\n")


def video_failure_reason(output: str, video_id: str) -> str:
    for line in output.splitlines():
        if video_id in line and "ERROR:" in line:
            return line.split("ERROR:",1)[1].strip()[:500]
    return output[-1000:].strip() or "yt-dlp produced no raw audio file"


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def jsonl_rows(path: Path) -> list[dict]:
    if not path.exists():
        return []
    rows = []
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.strip():
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError:
                continue
    return rows


def normalize_source(url: str) -> str:
    p = urlparse(url.strip())
    q = parse_qs(p.query)
    playlist_id = q.get("list", [None])[0]
    if playlist_id:
        return "https://www.youtube.com/playlist?" + urlencode({"list": playlist_id})
    video_id = None
    if p.hostname in {"youtu.be", "www.youtu.be"}:
        video_id = p.path.strip("/").split("/")[0]
    elif p.hostname and "youtube.com" in p.hostname:
        video_id = q.get("v", [None])[0]
        if not video_id and p.path.startswith("/shorts/"):
            video_id = p.path.split("/")[2]
    if video_id:
        return f"https://www.youtube.com/watch?v={video_id}"
    return url.strip()


def merge_source_entry(discovered: dict[str, dict], entry: dict, playlist_id: str | None) -> str:
    """Deduplicate an entry by video ID while collecting all playlist origins."""
    vid=str(entry.get("id") or entry.get("url") or "")
    if vid.startswith("http"):
        vid=vid.rstrip("/").split("=")[-1].split("/")[-1]
    item=discovered.setdefault(vid,{"id":vid,"webpage_url":entry.get("webpage_url") or f"https://www.youtube.com/watch?v={vid}","title":entry.get("title",""),"uploader":entry.get("uploader") or entry.get("channel",""),"channel":entry.get("channel",""),"upload_date":entry.get("upload_date",""),"duration":entry.get("duration"),"license":entry.get("license"),"playlist_ids":[]})
    for key in ("title","uploader","channel","upload_date","duration","license","webpage_url"):
        if entry.get(key) and not item.get(key): item[key]=entry[key]
    if playlist_id and playlist_id not in item["playlist_ids"]: item["playlist_ids"].append(playlist_id)
    return vid


def source_entries() -> list[str]:
    return [normalize_source(line) for line in (ROOT / "sources.txt").read_text(encoding="utf-8").splitlines() if line.strip() and not line.lstrip().startswith("#")]


def config() -> dict:
    return yaml.safe_load((ROOT / "config.yaml").read_text(encoding="utf-8"))


def config_hash(cfg: dict) -> str:
    payload = json.dumps(cfg, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(payload).hexdigest()


def tool_paths() -> tuple[str | None, str | None]:
    return shutil.which("ffmpeg"), shutil.which("ffprobe")


def require_ffmpeg() -> bool:
    ffmpeg, ffprobe = tool_paths()
    if ffmpeg and ffprobe:
        return True
    print("FFmpeg and ffprobe are required for this media stage. Install and reopen your terminal:\n  Windows: winget install Gyan.FFmpeg\n  macOS: brew install ffmpeg\n  Debian/Ubuntu: sudo apt update && sudo apt install ffmpeg\n  Fedora: sudo dnf install ffmpeg", file=sys.stderr)
    return False


def run_ytdlp(args: list[str], logger: logging.Logger, timeout: int = 600) -> subprocess.CompletedProcess:
    cmd = [sys.executable, "-m", "yt_dlp", *args]
    try:
        return subprocess.run(cmd, cwd=ROOT, text=True, capture_output=True, encoding="utf-8", errors="replace", timeout=timeout)
    except subprocess.TimeoutExpired as ex:
        return subprocess.CompletedProcess(cmd, 124, ex.stdout or "", (ex.stderr or "") + f"\nyt-dlp operation timed out after {timeout} seconds")


def enumerate_sources(limit: int | None = None) -> list[dict]:
    logger = setup_logging()
    meta_dir = DATA / "meta"
    meta_dir.mkdir(parents=True, exist_ok=True)
    state_path = DATA / "state" / "videos.jsonl"
    discovered: dict[str, dict] = {}
    source_totals = []
    recovered_sources = set()
    for source in source_entries():
        plid = parse_qs(urlparse(source).query).get("list", [None])[0]
        # Flat extraction is resilient to unavailable entries and returns the
        # complete playlist inventory without downloading or probing each item.
        args = ["--dump-single-json", "--skip-download", "--no-warnings", "--ignore-errors", "--flat-playlist"]
        args += ["--yes-playlist"] if plid else ["--no-playlist"]
        args.append(source)
        result = run_ytdlp(args, logger)
        if result.returncode:
            append_jsonl(DATA / "catalog" / "failed_videos.jsonl", {"source_url": source, "playlist_id": plid, "stage": "enumerate", "reason": (result.stderr or result.stdout)[-2000:]})
            logger.error("Source enumeration failed: %s", source)
            source_totals.append({"source_url": source, "playlist_id": plid, "found": 0, "error": result.stderr[-500:]})
            continue
        recovered_sources.add(source)
        try:
            info = json.loads(result.stdout)
        except json.JSONDecodeError:
            logger.error("Could not parse yt-dlp output for %s", source)
            continue
        entries = info.get("entries") if info.get("_type") == "playlist" or info.get("entries") is not None else [info]
        entries = [e for e in (entries or []) if e and (e.get("id") or e.get("url"))]
        source_totals.append({"source_url": source, "playlist_id": plid, "found": len(entries)})
        logger.info("Enumerated %d entries from %s", len(entries), source)
        for entry in entries:
            merge_source_entry(discovered,entry,plid)
    if limit is not None:
        discovered = dict(list(discovered.items())[:limit])
    complete = []
    for vid, shallow in discovered.items():
        item = {"video_id": vid, "title": shallow.get("title", ""), "uploader": shallow.get("uploader", ""), "channel": shallow.get("channel", ""), "upload_date": shallow.get("upload_date", ""), "duration": shallow.get("duration"), "license": shallow.get("license"), "webpage_url": shallow.get("webpage_url") or f"https://www.youtube.com/watch?v={vid}", "playlist_ids": shallow["playlist_ids"]}
        saved=meta_dir/f"{vid}.json"
        if saved.exists():
            try:
                previous=json.loads(saved.read_text(encoding="utf-8"))
                for key,value in previous.items():
                    if key=="playlist_ids": continue
                    if value and not item.get(key): item[key]=value
            except json.JSONDecodeError: pass
        write_json(meta_dir / f"{vid}.json", item)
        complete.append(item)
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text("".join(json.dumps(x, ensure_ascii=False) + "\n" for x in complete), encoding="utf-8")
    failed_path=DATA/"catalog"/"failed_videos.jsonl"
    previous_failures=jsonl_rows(failed_path)
    kept=[]; recovered_ids=set()
    for row in previous_failures:
        if row.get("stage")=="enumerate" and row.get("source_url") in recovered_sources:
            for video_id,reason in re.findall(r"ERROR: \[youtube\] ([A-Za-z0-9_-]{11}): ([^\r\n]+)",row.get("reason","")):
                append_jsonl(failed_path,{"video_id":video_id,"source_url":f"https://www.youtube.com/watch?v={video_id}","playlist_id":row.get("playlist_id"),"playlist_ids":[row.get("playlist_id")] if row.get("playlist_id") else [],"stage":"enumerate_entry","reason":reason})
                recovered_ids.add(video_id)
        else:
            kept.append(row)
    previous_failures=kept+[r for r in jsonl_rows(failed_path) if r.get("video_id") in recovered_ids]
    if failed_path.exists():
        failed_path.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in previous_failures),encoding="utf-8")
    write_json(DATA / "state" / "source_totals.json", source_totals)
    logger.info("Unique video IDs: %d", len(complete))
    return complete


def download(limit: int | None = None) -> None:
    logger = setup_logging()
    if not (DATA / "state" / "videos.jsonl").exists():
        enumerate_sources(limit)
    videos = jsonl_rows(DATA / "state" / "videos.jsonl")
    if limit is not None:
        videos = videos[:limit]
    raw = DATA / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    archive = DATA / "state" / "download_archive.txt"
    archive.parent.mkdir(parents=True, exist_ok=True)
    pending=[]
    for video in videos:
        files=[p for p in raw.glob(f"{video['video_id']}.*") if p.is_file() and p.suffix.lower() not in {".part",".ytdl",".temp"}]
        if not files: pending.append(video)
    if not pending:
        logger.info("All %d raw audio files already exist",len(videos)); return
    batch=DATA/"state"/"download_pending.txt"
    batch.write_text("".join(v["webpage_url"]+"\n" for v in pending),encoding="utf-8")
    args=["--format","bestaudio/best","--print-json","--ignore-errors","--no-playlist","--no-write-subs","--no-write-auto-subs","--no-write-thumbnail","--no-write-description","--no-overwrites","--download-archive",str(archive),"--batch-file",str(batch),"--sleep-interval","2","--max-sleep-interval","6","--retries","5","--extractor-retries","5","--output",str(raw/"%(id)s.%(ext)s")]
    browser=os.environ.get("YT_COOKIES_FROM_BROWSER")
    if browser: args[0:0]=["--cookies-from-browser",browser]
    result=run_ytdlp(args,logger,timeout=86400)
    details={}
    for line in (result.stdout or "").splitlines():
        try:
            item=json.loads(line)
            if item.get("id"): details[str(item["id"])]=item
        except json.JSONDecodeError: continue
    missing=[]
    for video in pending:
        vid=video["video_id"]
        files=[p for p in raw.glob(f"{vid}.*") if p.is_file() and p.suffix.lower() not in {".part",".ytdl",".temp"}]
        detail=details.get(vid)
        if detail:
            for key in ("title","uploader","channel","upload_date","duration","license","webpage_url"):
                if detail.get(key): video[key]=detail[key]
            write_json(DATA/"meta"/f"{vid}.json",{"video_id":vid,**{k:video.get(k) for k in ("title","uploader","channel","upload_date","duration","license","webpage_url","playlist_ids")}})
        if not files:
            excerpt=(result.stderr or result.stdout or "yt-dlp did not produce a raw audio file")[-2000:]
            missing.append(video)
            reason=video_failure_reason(result.stderr+"\n"+result.stdout,vid) if result.returncode else excerpt
            append_jsonl(DATA/"catalog"/"failed_videos.jsonl",{"video_id":vid,"source_url":video["webpage_url"],"playlist_ids":video.get("playlist_ids",[]),"stage":"download","reason":reason})
            logger.error("Download failed for %s",vid)
    if missing:
        logger.warning("Updating yt-dlp and retrying %d failed videos once",len(missing))
        subprocess.run([sys.executable,"-m","pip","install","-U","yt-dlp"],cwd=ROOT,capture_output=True,text=True)
        batch.write_text("".join(v["webpage_url"]+"\n" for v in missing),encoding="utf-8")
        retry=run_ytdlp(args,logger,timeout=86400)
        retry_details={}
        for line in (retry.stdout or "").splitlines():
            try:
                item=json.loads(line)
                if item.get("id"): retry_details[str(item["id"])]=item
            except json.JSONDecodeError: continue
        for video in missing:
            vid=video["video_id"]
            if not any(p.is_file() and p.suffix.lower() not in {".part",".ytdl",".temp"} for p in raw.glob(f"{vid}.*")):
                reason=video_failure_reason(retry.stderr+"\n"+retry.stdout,vid)
                append_jsonl(DATA/"catalog"/"failed_videos.jsonl",{"video_id":vid,"source_url":video["webpage_url"],"playlist_ids":video.get("playlist_ids",[]),"stage":"download_retry","reason":reason})
            detail=retry_details.get(vid)
            if detail:
                for key in ("title","uploader","channel","upload_date","duration","license","webpage_url"):
                    if detail.get(key): video[key]=detail[key]
                write_json(DATA/"meta"/f"{vid}.json",{"video_id":vid,**{k:video.get(k) for k in ("title","uploader","channel","upload_date","duration","license","webpage_url","playlist_ids")}})
    state_file=DATA/"state"/"videos.jsonl"
    state_rows=jsonl_rows(state_file)
    updated={v["video_id"]:v for v in pending}
    for row in state_rows:
        if row.get("video_id") in updated: row.update(updated[row["video_id"]])
    state_file.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in state_rows),encoding="utf-8")
    fail_path=DATA/"catalog"/"failed_videos.jsonl"
    if fail_path.exists():
        failures=jsonl_rows(fail_path)
        failures=[x for x in failures if not (x.get("stage") in {"download","download_retry"} and any(p.is_file() and p.suffix.lower() not in {".part",".ytdl",".temp"} for p in raw.glob(f"{x.get('video_id','')}.*")))]
        fail_path.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in failures),encoding="utf-8")
    if batch.exists(): batch.unlink()


def decode_audio(path: Path, sample_rate: int) -> np.ndarray:
    ffmpeg, _ = tool_paths()
    proc = subprocess.run([ffmpeg, "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sample_rate), "pipe:1"], capture_output=True)
    if proc.returncode:
        raise RuntimeError(proc.stderr.decode("utf-8", "replace")[-1000:])
    return np.frombuffer(proc.stdout, dtype="<f4").copy()


def frame_levels(audio: np.ndarray, sr: int, frame_ms: int, hop_ms: int) -> tuple[np.ndarray, np.ndarray]:
    frame = max(1, int(sr * frame_ms / 1000)); hop = max(1, int(sr * hop_ms / 1000))
    if len(audio) < frame:
        audio = np.pad(audio, (0, frame-len(audio)))
    starts = np.arange(0, len(audio)-frame+1, hop)
    rms = np.sqrt(np.mean(np.square(np.lib.stride_tricks.sliding_window_view(audio, frame)[::hop][:len(starts)]), axis=1) + 1e-15)
    return starts, 20 * np.log10(np.maximum(rms, 1e-12))


def gate_segments(audio: np.ndarray, sr: int, cfg: dict, min_silence_ms: int) -> list[tuple[int, int]]:
    a = cfg["analysis"]; s = cfg["segmentation"]
    starts, db = frame_levels(audio, sr, a["frame_ms"], a["hop_ms"])
    floor = float(np.clip(np.percentile(db, s["noise_percentile"]), s["noise_floor_min_db"], s["noise_floor_max_db"]))
    opening = floor + s["open_offset_db"]; closing = floor + s["close_offset_db"]
    active = np.zeros(len(db), dtype=bool); state = False
    for i, level in enumerate(db):
        state = level >= (closing if state else opening)
        active[i] = state
    # Close gaps shorter than the configured merge gap.
    max_gap = round(s["merge_gap_ms"] / a["hop_ms"])
    edges = np.diff(np.r_[False, active, False].astype(np.int8)); spans = list(zip(np.flatnonzero(edges == 1), np.flatnonzero(edges == -1)))
    merged = []
    for st, en in spans:
        if merged and st - merged[-1][1] < max_gap:
            merged[-1] = (merged[-1][0], en)
        else:
            merged.append((st, en))
    min_gap = round(min_silence_ms / a["hop_ms"])
    split = []
    for st, en in merged:
        if split and st - split[-1][1] >= min_gap:
            split.append((st, en))
        elif split:
            split[-1] = (split[-1][0], en)
        else:
            split.append((st, en))
    hop = round(sr * a["hop_ms"] / 1000)
    return [(max(0, int(st*hop)), min(len(audio), int(en*hop))) for st, en in split]


def valley_segments(audio: np.ndarray, sr: int, cfg: dict) -> list[tuple[int, int]]:
    a = cfg["analysis"]; s = cfg["segmentation"]
    starts, db = frame_levels(audio, sr, a["frame_ms"], a["hop_ms"])
    # Edge padding avoids false valleys caused by convolution's implicit zeros.
    width=21
    padded=np.pad(db,(width//2,width//2),mode="edge")
    smooth=np.convolve(padded,np.ones(width)/width,mode="valid")
    distance = max(1, round(s["valley_min_distance_ms"] / a["hop_ms"]))
    peaks, _ = find_peaks(-smooth, prominence=s["valley_prominence_db"], distance=distance)
    if not len(peaks):
        return []
    cuts = [0] + [int(starts[i]) for i in peaks] + [len(audio)]
    return [(x, y) for x, y in zip(cuts, cuts[1:]) if y > x]


def segment_plan(audio: np.ndarray, sr: int, cfg: dict) -> list[tuple[int, int, list[str]]]:
    """Return unpadded spans with review/length flags, independent of file I/O."""
    s=cfg["segmentation"]; a=cfg["analysis"]
    _, db=frame_levels(audio,sr,a["frame_ms"],a["hop_ms"])
    low_dynamic=(float(np.percentile(db,95)-np.percentile(db,10)) < s["low_dynamic_range_db"])
    spans=valley_segments(audio,sr,cfg) if low_dynamic else gate_segments(audio,sr,cfg,s["min_silence_ms"])
    max_samples=int(s["max_clip_ms"]*sr/1000)
    result=[]
    if low_dynamic and not spans and len(audio):
        flags=["needs_review","low_dynamic_range","unsplit"]
        if len(audio)>max_samples: flags.append("too_long")
        return [(0,len(audio),flags)]
    for st,en in spans:
        if en-st>max_samples:
            pieces=[]
            for silence in s["retry_silence_ms"]:
                pieces=gate_segments(audio[st:en],sr,cfg,silence)
                if len(pieces)>1 and max(y-x for x,y in pieces)<=max_samples:
                    break
            spans_to_add=[(st+x,st+y) for x,y in pieces] if len(pieces)>1 else [(st,en)]
        else:
            spans_to_add=[(st,en)]
        for x,y in spans_to_add:
            flags=["needs_review","low_dynamic_range"] if low_dynamic else []
            if y-x>max_samples: flags.append("too_long")
            result.append((x,y,flags))
    return result


def sha_pcm(samples: np.ndarray) -> str:
    pcm = np.clip(samples, -1, 1)
    return hashlib.sha1(np.round(pcm * 32767).astype("<i2").tobytes()).hexdigest()


def split_one(video: dict, raw_path: Path, cfg: dict, force: bool = False) -> list[dict]:
    logger = setup_logging(); _, ffprobe = tool_paths()
    vid = video["video_id"]; sr = cfg["analysis"]["sample_rate"]; segcfg = cfg["segmentation"]
    state_path = DATA / "state" / "processed.json"
    state = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {}
    digest = config_hash(cfg)
    if vid in state and state[vid].get("config_hash") == digest and not force:
        logger.info("Already split: %s", vid); return []
    if vid in state and state[vid].get("config_hash") != digest and not force:
        logger.warning("Config changed for %s; pass --force-resplit to replace existing derived clips", vid); return []
    if force and (DATA / "labels.csv").exists():
        backup = DATA / "labels.csv.bak"
        shutil.copy2(DATA / "labels.csv", backup)
    audio = decode_audio(raw_path, sr)
    override = cfg.get("overrides", {}).get(vid, {})
    start_trim = int(float(override.get("trim_head_s", 0))*sr)
    end_trim = max(start_trim, len(audio)-int(float(override.get("trim_tail_s", 0))*sr))
    audio = audio[start_trim:end_trim]
    skipped = [(int(a*sr), int(b*sr)) for a,b in override.get("skip_ranges", [])]
    ignored=set(); existing_hash={r.get("content_sha1"): r.get("clip_id") for r in jsonl_rows(DATA / "catalog" / "clips.jsonl")}
    plan=segment_plan(audio,sr,cfg)
    if plan and "low_dynamic_range" in plan[0][2]: logger.info("Low dynamic range fallback: %s",vid)
    clips=[]; rejected=[]
    head=int(segcfg["pad_head_ms"]*sr/1000); tail=int(segcfg["pad_tail_ms"]*sr/1000); fade=int(segcfg["fade_ms"]*sr/1000)
    hop=int(sr*cfg["analysis"]["hop_ms"]/1000)
    expanded=[(st,en) for st,en,_ in plan]
    for index,(st,en) in enumerate(expanded):
        if any(st < b and en > a for a,b in skipped): continue
        duration=en-st; flags=list(plan[index][2])
        min_n=int(segcfg["min_clip_ms"]*sr/1000)
        base=audio[st:en]
        peak=float(np.max(np.abs(base))) if len(base) else 0
        peak_db=20*np.log10(max(peak,1e-12))
        reason="too_short" if duration<min_n else ("effectively_silent" if peak<1e-6 else ("too_quiet" if peak_db<segcfg["peak_reject_db"] else None))
        if reason:
            rid=f"{vid}_{round((st+start_trim)*1000/sr/10)*10:07d}"
            rejdir=DATA/"rejected"/vid; rejdir.mkdir(parents=True,exist_ok=True)
            rej=audio[st:en]
            sf.write(rejdir/f"{rid}.wav", rej, sr, subtype="PCM_16")
            rejected.append({"clip_id":rid,"video_id":vid,"reason":reason,"start_s":(st+start_trim)/sr,"end_s":(en+start_trim)/sr})
            continue
        # Padding is bounded by halfway points to neighboring unpadded segments.
        left_bound=0 if index==0 else (expanded[index-1][1]+st)//2
        right_bound=len(audio) if index+1==len(expanded) else (en+expanded[index+1][0])//2
        ps=max(left_bound, st-head); pe=min(right_bound, en+tail)
        samples=audio[ps:pe].astype(np.float32).copy()
        orig_peak_db=20*np.log10(max(float(np.max(np.abs(samples))),1e-12))
        target=10**(segcfg["normalize_peak_db"]/20); gain=target/max(float(np.max(np.abs(samples))),1e-12)
        samples=np.clip(samples*gain,-1,1)
        if fade>0 and len(samples)>2*fade:
            samples[:fade]*=np.linspace(0,1,fade,dtype=np.float32); samples[-fade:]*=np.linspace(1,0,fade,dtype=np.float32)
        clipid=f"{vid}_{round((st+start_trim)*1000/sr/10)*10:07d}"
        sha=sha_pcm(samples); other=existing_hash.get(sha)
        if other and other != clipid: flags.append(f"duplicate_of:{other}")
        if len(flags)==0: flags=[]
        wav=DATA/"clips"/"wav"/vid/f"{clipid}.wav"; ogg=DATA/"clips"/"ogg"/vid/f"{clipid}.ogg"
        wav.parent.mkdir(parents=True,exist_ok=True); ogg.parent.mkdir(parents=True,exist_ok=True)
        if wav.exists() and not force: raise FileExistsError(f"Refusing to overwrite {wav}; use --force-resplit")
        sf.write(wav,samples,sr,subtype="PCM_16")
        subprocess.run([shutil.which("ffmpeg"),"-y","-v","error","-i",str(wav),"-c:a","libvorbis","-q:a",str(segcfg["ogg_quality"]),str(ogg)],check=True,capture_output=True)
        rms_db=20*np.log10(max(float(np.sqrt(np.mean(samples*samples))),1e-12))
        clip={"clip_id":clipid,"wav_path":str(wav.relative_to(ROOT)).replace("\\","/"),"ogg_path":str(ogg.relative_to(ROOT)).replace("\\","/"),"source_url":video.get("webpage_url",""),"video_id":vid,"playlist_ids":video.get("playlist_ids",[]),"video_title":video.get("title",""),"uploader":video.get("uploader",""),"upload_date":video.get("upload_date",""),"start_s":round((st+start_trim)/sr,3),"end_s":round((en+start_trim)/sr,3),"duration_ms":round(len(samples)*1000/sr),"sample_rate":sr,"channels":1,"orig_peak_db":round(orig_peak_db,2),"gain_db":round(20*np.log10(gain),2),"rms_db":round(rms_db,2),"content_sha1":sha,"flags":flags,"split_config_hash":digest}
        clips.append(clip); existing_hash[sha]=clipid
    rejected_path=DATA/"catalog"/"rejected.jsonl"
    old_rejected=[r for r in jsonl_rows(rejected_path) if r.get("video_id")!=vid]
    rejected_path.parent.mkdir(parents=True,exist_ok=True)
    rejected_path.write_text("".join(json.dumps(r,ensure_ascii=False)+"\n" for r in old_rejected+rejected),encoding="utf-8")
    all_rows=jsonl_rows(DATA/"catalog"/"clips.jsonl")
    all_rows=[r for r in all_rows if r.get("video_id")!=vid] + clips
    state[vid]={"config_hash":digest,"processed_at":datetime.now(timezone.utc).isoformat(),"clip_ids":[r["clip_id"] for r in clips],"raw_file":raw_path.name}
    write_json(state_path,state)
    write_json(DATA/"catalog"/"clips.jsonl",{}) if False else None
    # Machine catalog is rewritten atomically from current state.
    out=DATA/"catalog"/"clips.jsonl"; out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text("".join(json.dumps(r,ensure_ascii=False)+"\n" for r in all_rows),encoding="utf-8")
    logger.info("Split %s: %d clips, %d rejected",vid,len(clips),len(rejected))
    return clips


def split_all(limit: int | None = None, force: bool = False) -> None:
    logger=setup_logging()
    if not require_ffmpeg(): return
    videos=jsonl_rows(DATA/"state"/"videos.jsonl")
    if limit is not None: videos=videos[:limit]
    cfg=config()
    for v in videos:
        files=list((DATA/"raw").glob(f"{v['video_id']}.*"))
        if not files:
            continue
        try: split_one(v,files[0],cfg,force)
        except Exception as ex:
            append_jsonl(DATA/"catalog"/"failed_videos.jsonl",{"video_id":v["video_id"],"source_url":v.get("webpage_url"),"stage":"split","reason":str(ex)})
            logger.exception("Split failed for %s",v["video_id"])


def catalog() -> None:
    rows=jsonl_rows(DATA/"catalog"/"clips.jsonl")
    out=DATA/"catalog"/"clips.csv"; out.parent.mkdir(parents=True,exist_ok=True)
    with out.open("w",newline="",encoding="utf-8-sig") as f:
        w=csv.DictWriter(f,fieldnames=CLIP_COLUMNS); w.writeheader()
        for r in rows: w.writerow({**r,"playlist_ids":json.dumps(r.get("playlist_ids",[]),ensure_ascii=False),"flags":json.dumps(r.get("flags",[]),ensure_ascii=False)})
    label=DATA/"labels.csv"
    legacy_label=DATA/"catalog"/"labels.csv"
    if not label.exists() and legacy_label.exists():
        label.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(legacy_label),str(label))
    existing={}
    if label.exists():
        with label.open(encoding="utf-8-sig",newline="") as f:
            reader=csv.DictReader(f)
            existing={r.get("clip_id"):r for r in reader if r.get("clip_id")}
        if any(r["clip_id"] not in existing for r in rows):
            bak=label.with_suffix(".csv.bak")
            shutil.copy2(label,bak)
    missing=[r["clip_id"] for r in rows if r["clip_id"] not in existing]
    if missing:
        new=not label.exists()
        with label.open("a",newline="",encoding="utf-8-sig" if new else "utf-8",) as f:
            w=csv.DictWriter(f,fieldnames=LABEL_COLUMNS)
            if new: w.writeheader()
            for cid in missing: w.writerow({"clip_id":cid,"status":"unlabeled"})
    videos=jsonl_rows(DATA/"state"/"videos.jsonl")
    vp=DATA/"catalog"/"videos.jsonl"; vp.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in videos),encoding="utf-8")


def normalized_failures(videos: list[dict], persist: bool = False) -> list[dict]:
    path=DATA/"catalog"/"failed_videos.jsonl"
    rows=jsonl_rows(path)
    by_id={v.get("video_id"):v for v in videos}
    failures={}
    for row in rows:
        vid=row.get("video_id")
        if not vid:
            failures[f"source:{row.get('source_url')}:{row.get('stage')}"]=row
            continue
        if any(p.is_file() and p.suffix.lower() not in {".part",".ytdl",".temp"} for p in (DATA/"raw").glob(f"{vid}.*")):
            continue
        source=by_id.get(vid,{})
        row["playlist_ids"]=row.get("playlist_ids") or source.get("playlist_ids",[])
        failures[vid]=row
    for vid,row in list(failures.items()):
        row["stage"]="download"
        row["attempts"]=2 if any(x.get("video_id")==vid and x.get("stage")=="download_retry" for x in rows) else row.get("attempts",1)
    result=list(failures.values())
    if persist and path.exists():
        path.write_text("".join(json.dumps(x,ensure_ascii=False)+"\n" for x in result),encoding="utf-8")
    return result


def report() -> None:
    logger=setup_logging(); videos=jsonl_rows(DATA/"state"/"videos.jsonl"); clips=jsonl_rows(DATA/"catalog"/"clips.jsonl"); failed=normalized_failures(videos,persist=True); rejected=jsonl_rows(DATA/"catalog"/"rejected.jsonl")
    totals=json.loads((DATA/"state"/"source_totals.json").read_text(encoding="utf-8")) if (DATA/"state"/"source_totals.json").exists() else []
    lines=["# Veel Veel dataset report","",f"Unique videos enumerated: {len(videos)}",f"Clips produced: {len(clips)}",f"Rejected segments: {len(rejected)}",f"Failed entries: {len(failed)}",f"Total clip audio: {sum(c.get('duration_ms',0) for c in clips)/60000:.2f} minutes","","## Per source","","| Source | Found | Downloaded | Failed |", "|---|---:|---:|---:|"]
    for t in totals:
        pl=t.get("playlist_id"); matching=[v for v in videos if (v.get("webpage_url")==t.get("source_url") if not pl else pl in v.get("playlist_ids",[]))]
        downloaded=sum(1 for v in matching if list((DATA/"raw").glob(f"{v['video_id']}.*")))
        matching_ids={v["video_id"] for v in matching}
        failed_n=sum(1 for x in failed if x.get("video_id") in matching_ids or (x.get("playlist_id")==pl and not x.get("video_id")))
        lines.append(f"| {t['source_url']} | {t.get('found',0)} | {downloaded} | {failed_n} |")
    from collections import Counter
    review=Counter(c["video_id"] for c in clips if "needs_review" in c.get("flags",[]))
    lines += ["","## Most needs-review clips","", "| Video ID | Clips flagged |", "|---|---:|"]
    lines += [f"| {vid} | {n} |" for vid,n in review.most_common(10)] or ["| None | 0 |"]
    if failed:
        lines += ["","## Failures",""]+[f"- {x.get('video_id') or x.get('source_url')}: {x.get('reason','')[:300]}" for x in failed]
    out=DATA/"reports"/"summary.md"; out.parent.mkdir(parents=True,exist_ok=True); out.write_text("\n".join(lines)+"\n",encoding="utf-8")
    if not require_ffmpeg(): return
    probe_errors=[]
    for c in clips:
        for key in ("wav_path","ogg_path"):
            target=ROOT/c[key]
            if not target.exists():
                probe_errors.append(f"{c['clip_id']} missing {key}"); continue
            try:
                raw=subprocess.run([tool_paths()[1],"-v","error","-show_entries","format=duration:stream=sample_rate,channels","-of","json",str(target)],capture_output=True,text=True,encoding="utf-8",errors="replace",timeout=30,check=True)
                info=json.loads(raw.stdout); stream=info["streams"][0]; duration=float(info["format"]["duration"])
                if int(stream["sample_rate"])!=44100 or int(stream["channels"])!=1 or abs(duration-c["duration_ms"]/1000)>0.02:
                    probe_errors.append(f"{c['clip_id']} {key}: sr={stream.get('sample_rate')} channels={stream.get('channels')} duration={duration:.3f}s")
            except Exception as ex:
                probe_errors.append(f"{c['clip_id']} {key}: {ex}")
    if probe_errors:
        (DATA/"reports"/"validation_errors.txt").write_text("\n".join(probe_errors)+"\n",encoding="utf-8")
        logger.error("ffprobe validation issues: %d",len(probe_errors))
    else:
        (DATA/"reports"/"validation_errors.txt").unlink(missing_ok=True)
        logger.info("Validated %d WAV/OGG files with ffprobe",len(clips)*2)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        logger.warning("matplotlib unavailable; summary written without plots"); return
    for v in videos:
        rawfiles=list((DATA/"raw").glob(f"{v['video_id']}.*"))
        if not rawfiles: continue
        try:
            audio=decode_audio(rawfiles[0],44100); times=np.arange(len(audio))/44100
            fig,ax=plt.subplots(figsize=(14,3)); ax.plot(times[::220],audio[::220],lw=.35)
            for c in clips:
                if c["video_id"]==v["video_id"]:
                    ax.axvspan(c["start_s"],c["end_s"],alpha=.18,color="green")
            ax.set(xlabel="Time (s)",ylabel="Amplitude",title=v["video_id"])
            fig.tight_layout(); fig.savefig(DATA/"reports"/f"{v['video_id']}.png",dpi=120); plt.close(fig)
        except Exception as ex: logger.warning("Waveform failed for %s: %s",v["video_id"],ex)


def export_pack() -> None:
    template=ROOT/"reference"/"veel-veel-tamil-pack.json"
    if not template.exists():
        raise FileNotFoundError("Place reference/veel-veel-tamil-pack.json before export-pack")
    schema=json.loads(template.read_text(encoding="utf-8")); clips={c["clip_id"]:c for c in jsonl_rows(DATA/"catalog"/"clips.jsonl")}
    labels=DATA/"labels.csv"
    with labels.open(encoding="utf-8-sig",newline="") as f: label_rows=list(csv.DictReader(f))
    packed=[]
    for lab in label_rows:
        if lab.get("keep","").lower()!="y" or not lab.get("title","").strip() or lab.get("clip_id") not in clips: continue
        packed.append({**clips[lab["clip_id"]],**lab})
    result=schema
    if isinstance(schema,dict):
        key="clips" if "clips" in schema else next((k for k,v in schema.items() if isinstance(v,list)),"clips")
        result={**schema,key:packed}
    else: result=packed
    write_json(DATA/"catalog"/"pack.json",result)
