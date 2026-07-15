# 🎁 Hello Dad — Pull My Finger

A very important website. You arrive, you open a present, a hand emerges,
you pull a finger, and physics does the rest.

## How it works

1. 🎁 Click the present to open it
2. ✋ A hand appears — click any finger (thumb included)
3. 💨 A random fart rings out
4. 🎉 Confetti, congratulations, and the option to do it all again

## Running it

It's a static site — no build step. Open `index.html` in a browser, or:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Fart sounds

By default, farts are **synthesized live** with the Web Audio API — five
randomized styles (ripper, sputter, squeaker, rumbler, toot) so no two
pulls sound alike.

Want real recordings instead? See [`sounds/README.md`](sounds/README.md)
— drop `fart1.mp3` … `fart10.mp3` into `sounds/` and the site uses them
automatically.
