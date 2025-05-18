# screenshot.py
import mss
import mss.tools
import tempfile
import os
import sys

with mss.mss() as sct:
    temp_paths = []
    for i, monitor in enumerate(sct.monitors[1:], start=1):
        # Create a temporary file for each screenshot
        fd, temp_path = tempfile.mkstemp(suffix='.png', prefix=f'monitor-{i}-')
        os.close(fd)
        
        # Take the screenshot and save it to the temp file
        sct_img = sct.grab(monitor)
        mss.tools.to_png(sct_img.rgb, sct_img.size, output=temp_path)
        
        # Store the temporary path
        temp_paths.append(temp_path)

# Output the paths to stdout for the TypeScript code to read
for path in temp_paths:
    print(path)