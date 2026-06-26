# Triangle Art

Turn a photo into generative art made of triangles. Drop in an image — or point your
webcam at yourself — and watch it get carved into thousands of right-angled triangles
that trace the light and dark of the picture.

**[Live demo](https://karlrombauts.github.io/TriangleArt/)**

<!-- TODO: drop in a screenshot or two here -->

## Where this came from

This started in an advanced algorithms class. The lecturer posed a puzzle: given a
rectangle, for which values of `n` can you cut it into `n` right-angled triangles? The
nice observation is that any right-angled triangle splits into two smaller (and similar)
right-angled triangles, so a rectangle can be cut into any `n ≥ 2`.

That subdivision is infinite, which makes it fun to play with. Organise the triangles as
a binary tree — each split is two children — and you can grow the pattern with BFS or DFS.
And since a denser cluster of white edges reads as brighter, you can drive the subdivision
from a photo's brightness: more triangles where the image is light, fewer where it's dark,
and the picture falls out of it.

I wrote up the original maths and the first p5.js version here:
[Making Generative Art With Triangles](https://medium.com/@karlrombauts). <!-- TODO: confirm exact article URL -->
This repo is a rebuilt, interactive version of that demo.

## How it works (short version)

- The image starts as a rectangle, split along its diagonal into two right triangles.
- Each triangle is sampled for its average brightness, weighted by its area. Large, bright
  triangles keep splitting; small or flat ones stop. (Invert the colours and the
  subdivision flips to follow the dark regions instead, so it stays representational.)
- Rather than always cutting at the right angle, the split slides along the triangle's
  longest edge to land on the strongest light/dark boundary inside it, so triangle edges
  follow the contours of the photo. Roughly uniform triangles just split down the middle.
- It all runs in a Web Worker so the interface stays responsive, and the detail slider
  filters a pre-built tree rather than recomputing, so changing detail is instant.

The article has the full derivation — the vector projection, the dot products, and the
pixel-sampling shortcut that keeps it fast.

## Features

- Load a photo, drag-and-drop, choose a sample, or triangulate your webcam in real time
- Detail, contrast, and line-weight sliders
- Background and line colours, plus a few preset looks
- A before/after slider to compare against the original
- Export as a PNG, or as a true vector SVG that scales to any size

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm test         # engine unit tests
```

Built with Svelte, Vite, TypeScript, and the Canvas 2D API. There's no backend — it all
runs in the browser.

## Credits

- Alan Turing portrait — public domain
- Sample photos from [Unsplash](https://unsplash.com): Antonia Glaskova, Fabian Gieske,
  Rowan Heuvel, Ryan Grewell, and The Blowup
