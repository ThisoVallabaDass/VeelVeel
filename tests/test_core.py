import numpy as np
import json

from sound_harvest import core
from sound_harvest.core import config, gate_segments, merge_source_entry, normalize_source, segment_plan, valley_segments


def test_url_normalization_and_playlist_expansion():
    assert normalize_source("https://youtu.be/abc123?si=tracking") == "https://www.youtube.com/watch?v=abc123"
    assert normalize_source("https://youtube.com/watch?v=abc123&list=PLxyz&si=tracking") == "https://www.youtube.com/playlist?list=PLxyz"


def test_cross_source_entries_deduplicate_and_retain_playlist_ids():
    found={}
    merge_source_entry(found,{"id":"abc123","title":"A"},"PLone")
    merge_source_entry(found,{"id":"abc123","title":"A"},"PLtwo")
    assert len(found)==1
    assert found["abc123"]["playlist_ids"]==["PLone","PLtwo"]


def test_five_bursts_separated_by_silence():
    sr=44100; burst=np.sin(2*np.pi*440*np.arange(int(.3*sr))/sr).astype(np.float32)*.5
    audio=np.zeros(sr*5,dtype=np.float32)
    for i in range(5): audio[int(i*.9*sr):int(i*.9*sr)+len(burst)]=burst
    spans=gate_segments(audio,sr,config(),400)
    assert len(spans)==5


def test_low_dynamic_bed_can_use_valley_splitter():
    sr=44100; t=np.arange(sr*5)/sr
    audio=(.045*np.sin(2*np.pi*110*t)).astype(np.float32)
    for start in (.25,1.15,2.05,2.95,3.85):
        i=int(start*sr); audio[i:i+int(.3*sr)]+=.08*np.sin(2*np.pi*650*np.arange(int(.3*sr))/sr)
    plan=segment_plan(audio,sr,config())
    assert len(plan)>=1
    assert all("needs_review" in flags and "low_dynamic_range" in flags for _,_,flags in plan)


def test_continuous_25_second_tone_is_flagged_too_long():
    sr=44100
    tone=(.1*np.sin(2*np.pi*440*np.arange(sr*25)/sr)).astype(np.float32)
    plan=segment_plan(tone,sr,config())
    assert len(plan)==1
    assert "too_long" in plan[0][2]
    assert "unsplit" in plan[0][2]


def test_padding_bounds_neighbor_midpoint():
    spans=[(1000,2000),(2500,3500)]
    left_bound=(spans[0][1]+spans[1][0])//2
    right_bound=left_bound
    first_end=min(right_bound,spans[0][1]+900)
    second_start=max(left_bound,spans[1][0]-900)
    assert first_end<=second_start


def test_resume_skips_download_and_resplit(tmp_path, monkeypatch):
    data=tmp_path/"data"; (data/"raw").mkdir(parents=True); (data/"state").mkdir()
    video={"video_id":"resume123","webpage_url":"https://www.youtube.com/watch?v=resume123","playlist_ids":[]}
    (data/"state"/"videos.jsonl").write_text(json.dumps(video)+"\n",encoding="utf-8")
    (data/"raw"/"resume123.webm").write_bytes(b"placeholder raw audio")
    state={"resume123":{"config_hash":core.config_hash(core.config()),"clip_ids":["resume123_0000000"]}}
    state_path=data/"state"/"processed.json"
    state_path.write_text(json.dumps(state),encoding="utf-8")
    monkeypatch.setattr(core,"DATA",data)
    monkeypatch.setattr(core,"run_ytdlp",lambda *a,**k: (_ for _ in ()).throw(AssertionError("unexpected download")))
    monkeypatch.setattr(core,"require_ffmpeg",lambda: True)
    monkeypatch.setattr(core,"decode_audio",lambda *a,**k: (_ for _ in ()).throw(AssertionError("unexpected resplit")))
    core.download()
    core.split_all()
    assert state_path.read_text(encoding="utf-8")==json.dumps(state)
