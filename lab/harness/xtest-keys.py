#!/usr/bin/env python3
"""Press a key chord as real X11 input through the XTest extension (libXtst, via ctypes).

Usage: DISPLAY=:99 python3 xtest-keys.py Alt+Shift+B [x y]

Chrome reads this input like a user's keyboard, so browser accelerators and extension
commands (chrome.commands) receive it; keys sent through the DevTools protocol never reach
them. With x y, the pointer first moves there, because without a window manager the X focus
follows the pointer. Used by dev-capture-qa.mjs under xvfb-run.
"""
import ctypes
import sys

KEYSYMS = {"alt": "Alt_L", "shift": "Shift_L", "ctrl": "Control_L", "control": "Control_L"}


def main():
    chord = sys.argv[1].split("+")
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
    display = x11.XOpenDisplay(None)
    if not display:
        sys.exit("cannot open the X display; run under xvfb-run")
    if len(sys.argv) == 4:
        xtst.XTestFakeMotionEvent(display, -1, int(sys.argv[2]), int(sys.argv[3]), 0)
    codes = []
    for key in chord:
        name = KEYSYMS.get(key.lower(), key.lower() if len(key) == 1 else key)
        code = x11.XKeysymToKeycode(display, x11.XStringToKeysym(name.encode()))
        if not code:
            sys.exit(f"no keycode for {key}")
        codes.append(code)
    for code in codes:
        xtst.XTestFakeKeyEvent(display, code, 1, 0)
    for code in reversed(codes):
        xtst.XTestFakeKeyEvent(display, code, 0, 0)
    x11.XFlush(display)
    x11.XCloseDisplay(display)


if __name__ == "__main__":
    main()
