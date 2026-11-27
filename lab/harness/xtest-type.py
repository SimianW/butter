#!/usr/bin/env python3
"""Run a key sequence as real X11 input through the XTest extension (libXtst, via ctypes), with
the time of every key press.

Usage: DISPLAY=:98 python3 xtest-type.py < steps.json

steps.json is a JSON list of steps, run in order:
  {"move": [x, y]}                  move the pointer (no window manager: X focus follows it)
  {"chord": "ctrl+f"}               press and release a chord, as xtest-keys.py does
  {"text": "...", "gapMs": 100}     type the text one key at a time, gapMs between presses
  {"sleep": 500}                    wait (ms)

Prints one JSON object: {"stamps": [{"step": i, "kind": "chord" | "char", "at": <epoch ms>}]},
one stamp per key press, taken just before the press is flushed. Typed characters are never
printed, so the text (page text, in the lab) stays out of the logs. The text is read from stdin,
not the command line, so it is not in the process list either. Characters: letters, digits,
space and , . - ' ; others exit 2. Used by stream-findbar-probe.mjs (the u4 find-bar mode).
"""
import ctypes
import json
import sys
import time

KEYSYMS = {"alt": "Alt_L", "shift": "Shift_L", "ctrl": "Control_L", "control": "Control_L", "esc": "Escape"}
CHARS = {" ": "space", ",": "comma", ".": "period", "-": "minus", "'": "apostrophe"}


def setup():
    x11 = ctypes.CDLL("libX11.so.6")
    xtst = ctypes.CDLL("libXtst.so.6")
    x11.XOpenDisplay.restype = ctypes.c_void_p
    x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
    x11.XStringToKeysym.restype = ctypes.c_ulong
    x11.XStringToKeysym.argtypes = [ctypes.c_char_p]
    x11.XKeysymToKeycode.restype = ctypes.c_ubyte
    x11.XKeysymToKeycode.argtypes = [ctypes.c_void_p, ctypes.c_ulong]
    x11.XFlush.argtypes = [ctypes.c_void_p]
    x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
    xtst.XTestFakeKeyEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
    xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
    return x11, xtst


def main():
    steps = json.load(sys.stdin)
    x11, xtst = setup()
    display = x11.XOpenDisplay(None)
    if not display:
        sys.exit("cannot open the X display; set DISPLAY")

    def code(name):
        c = x11.XKeysymToKeycode(display, x11.XStringToKeysym(name.encode()))
        if not c:
            print(json.dumps({"error": "no keycode for a key"}))
            sys.exit(2)
        return c

    def press(codes):
        for c in codes:
            xtst.XTestFakeKeyEvent(display, c, 1, 0)
        for c in reversed(codes):
            xtst.XTestFakeKeyEvent(display, c, 0, 0)
        x11.XFlush(display)

    def char_codes(ch):
        if ch in CHARS:
            return [code(CHARS[ch])]
        if ch.isascii() and ch.isalnum():
            base = [code(ch.lower())]
            return [code("Shift_L")] + base if ch.isupper() else base
        print(json.dumps({"error": "unsupported character"}))
        sys.exit(2)

    stamps = []
    for i, s in enumerate(steps):
        if "move" in s:
            xtst.XTestFakeMotionEvent(display, -1, int(s["move"][0]), int(s["move"][1]), 0)
            x11.XFlush(display)
        elif "chord" in s:
            codes = [code(KEYSYMS.get(k.lower(), k.lower() if len(k) == 1 else k)) for k in s["chord"].split("+")]
            stamps.append({"step": i, "kind": "chord", "at": time.time() * 1000})
            press(codes)
        elif "text" in s:
            gap = s.get("gapMs", 100) / 1000
            for j, ch in enumerate(s["text"]):
                if j:
                    time.sleep(gap)
                codes = char_codes(ch)
                stamps.append({"step": i, "kind": "char", "at": time.time() * 1000})
                press(codes)
        elif "sleep" in s:
            time.sleep(s["sleep"] / 1000)
    x11.XCloseDisplay(display)
    print(json.dumps({"stamps": stamps}))


if __name__ == "__main__":
    main()
