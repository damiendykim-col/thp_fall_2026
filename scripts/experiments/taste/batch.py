#!/usr/bin/env python3
"""Python entry point for the paced batch runner; reuses the existing Node pipeline.

No dependencies beyond Python and the project's Node runtime. Arguments, exit
status and terminal environment pass through; no credentials are read from files.
"""
import os
from pathlib import Path
import shutil
import sys

if __name__ == '__main__':
    node = shutil.which('node')
    if not node:
        sys.exit('Node is required; activate the runtime used for this project.')
    os.execv(node, [node, str(Path(__file__).with_suffix('.mjs')), *sys.argv[1:]])
