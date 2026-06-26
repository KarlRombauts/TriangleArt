# Triangle Art

A small hobby project I made to turn a photo into generative art made of triangles. You can upload an image or use your webcam and your image will get turned into into thousands of triangles that trace the light and dark of the picture.

**[Live demo](https://karlrombauts.github.io/TriangleArt/)**

<!-- TODO: drop in a screenshot or two here -->

## Where this came from

This started in an advanced algorithms class in 2022. The lecturer posed a puzzle: given a
rectangle, for which values of $n$ can you cut it into $n$ right-angled triangles? The
nice observation is that any right-angled triangle splits into two smaller (and similar)
right-angled triangles, so a rectangle can be cut into any $n \geq 2$.

That subdivision is infinite, which makes it fun to play with. I organised the triangles as
a binary tree, each traingle split is represented as two child nodes in the tree.
And since a denser cluster of white edges reads as brighter, you can drive the subdivision
from a photo's brightness by creating more triangles where the image is light and fewer where it's dark.

I wrote up the original maths and the for the first version here:
[Making Generative Art With Triangles](https://medium.com/@karlrombauts/making-generative-art-with-triangles-273702d20f42). 

## How it works (short version)

- The image starts as a rectangle, split along its diagonal into two right triangles.
- Each triangle is sampled for its average brightness, weighted by its area. Large, bright
  triangles keep splitting and smaller ones stop.
- The main change from the original: instead of always cutting at the right angle, I now pick the *best angle to bisect*. The cut runs from a vertex to the point along the opposite edge where the brightness changes most, so the triangle edges line up with the contours in the photo (it falls back to a straight halving when a triangle has no clear edge). 
- All the triangle subdivision calculations run in a web worker so the interface stays responsive.

## Features

- Load a photo, drag-and-drop, choose a sample, or triangulate your webcam in real time
- Detail, contrast, and line-weight sliders
- Background and line colours, plus a few preset looks
- A before/after slider to compare against the original
- Export as a PNG, or SVG

## Running it

```bash
npm install
npm run dev      # local dev server
npm run build    # production build
npm test         # engine unit tests
```

Built with Svelte, Vite, TypeScript, and the Canvas 2D API. There's no backend, it
runs completely in the browser.

## Credits

- Alan Turing portrait — public domain
- Sample photos from [Unsplash](https://unsplash.com): Antonia Glaskova, Fabian Gieske,
  Rowan Heuvel, Ryan Grewell, and The Blowup
