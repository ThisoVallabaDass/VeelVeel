from __future__ import annotations

import argparse

from .core import catalog, download, enumerate_sources, report, setup_logging, split_all, export_pack


def main() -> None:
    parser=argparse.ArgumentParser(prog="sound-harvest",description="Reproducible audio dataset pipeline for Veel Veel")
    sub=parser.add_subparsers(dest="command")
    for name in ("enumerate","download","split","catalog","report","export-pack","run"):
        p=sub.add_parser(name)
        if name in {"enumerate","download","split","run"}: p.add_argument("--limit",type=int)
        if name in {"split","run"}: p.add_argument("--force-resplit",action="store_true")
    args=parser.parse_args()
    cmd=args.command or "run"
    logger=setup_logging()
    if cmd=="enumerate": enumerate_sources(args.limit)
    elif cmd=="download": download(args.limit)
    elif cmd=="split": split_all(args.limit,args.force_resplit)
    elif cmd=="catalog": catalog()
    elif cmd=="report": report()
    elif cmd=="export-pack": export_pack()
    elif cmd=="run":
        enumerate_sources(args.limit)
        download(args.limit)
        split_all(args.limit,args.force_resplit)
        catalog()
        report()
    logger.info("Stage complete: %s",cmd)
