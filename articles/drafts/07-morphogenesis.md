# Diffusion Usually Erases Patterns. Alan Turing Proved It Can Create Them.

*I built a live reaction-diffusion engine that grows the same spots, stripes, and labyrinths found on animal skin, coral, and fingerprints. It runs at sixty frames a second in a WebGL fragment shader, and you can paint into it. Here is the math and the machinery.*

## The counterintuitive idea

Diffusion smooths things out. Drop ink in water and it spreads until the color goes uniform, so structure is about the last thing you'd expect it to build.

Then in 1952, in his only paper on biology, Turing showed it can do exactly that (A. M. Turing, "The Chemical Basis of Morphogenesis," Philosophical Transactions of the Royal Society B, 1952). Take two substances: an activator that promotes itself, and an inhibitor that suppresses the activator. Let the inhibitor diffuse faster than the activator. Now a perfectly uniform sheet becomes unstable. Tiny random fluctuations grow instead of fading, and they settle into a regular pattern with a characteristic spacing. Turing called the substances morphogens; the effect is now called diffusion-driven instability. Short-range activation, long-range inhibition. That's the whole trick.

I still find that genuinely strange. And that single idea is a candidate explanation for how a featureless ball of identical cells decides where to put stripes, spots, and fingers.

## The model in the demo

The demo runs the Gray-Scott system, a specific reaction-diffusion scheme built on an autocatalytic reaction. U and V are the two chemicals:

```
U + 2V -> 3V        (V catalyzes its own production, consuming U)
V      -> P         (V decays to an inert product)
```

Written as partial differential equations, with F a feed rate that replenishes U and k a kill rate that removes V:

```
du/dt = Du * laplacian(u) - u*v*v + F*(1 - u)
dv/dt = Dv * laplacian(v) + u*v*v - (F + k)*v
```

The activator here is V. The part that matters: the activator diffuses slower than the substrate it feeds on. Change F and k, and the same two equations produce wildly different outcomes.

## Running it on the GPU

Every cell of the grid needs the same update every step. That is exactly what a GPU is for. The chemical field lives in a pair of 512 by 320 floating-point textures (WebGL2 with the EXT_color_buffer_float extension), with U and V stored in the red and green channels. Each animation frame runs twelve Euler steps by ping-ponging between the two textures: read the current state, write the next, swap, repeat. The name sounds sillier than the idea, which is really just reusing two buffers instead of allocating fresh ones every step.

The reaction step is the heart of the simulation shader. It is almost a direct transcription of the equations above:

```glsl
float u = c.x, v = c.y;
float reaction = u * v * v;
float du = u_du * lap.x - reaction + u_f * (1.0 - u);
float dv = u_dv * lap.y + reaction - (u_f + u_k) * v;
vec2 n = clamp(c + vec2(du, dv) * u_dt, 0.0, 1.0);
```

The Laplacian measures how much a cell differs from its neighbors. Here it is a nine-point stencil that reads the eight surrounding texels with the standard weights: 0.2 for the orthogonal neighbors, 0.05 for the diagonals, and -1 for the center. A second shader injects fresh activator wherever you click and drag, so you can poke the field and watch it heal. A third maps concentration through a color ramp, with in-shader bilinear upsampling so the pattern looks smooth rather than blocky. No pixel ever leaves the GPU.

## The parameter map is the science

The presets aren't arbitrary. In 1993, John Pearson mapped the Gray-Scott parameter space and catalogued how small moves in F and k slide the system between regimes (J. E. Pearson, "Complex Patterns in a Simple System," Science, 1993). Stable spots, growing coral fronts, self-replicating spots that divide like cells, travelling waves, maze-like labyrinths: they all live at different coordinates in that one plane. The demo gives you two sliders, F and k. Dragging them is literally walking Pearson's map, and the named presets are just landmarks on it.

## It matches real organisms

Pretty math is cheap. Does any of it describe actual animals? The framework keeps earning biological support:

- Kondo and Miura reviewed how reaction-diffusion explains real pattern formation, and showed that zebrafish skin stripes rearrange the way a Turing system predicts (S. Kondo and T. Miura, Science, 2010).
- Digit formation in the vertebrate limb behaves like a Turing mechanism whose wavelength, and therefore how many fingers you get, is tuned by Hox genes (Sheth et al., Science, 2012).
- Even human fingerprints were traced to a reaction-diffusion system of WNT, BMP, and EDAR signaling, with the ridge patterns set by the same activator-inhibitor dynamics (Glover et al., Cell, 2023).

The spots you paint into on screen are governed by the same class of equations that pattern living tissue.

## Honesty and correctness

The simulation is the real thing, not a video or a canned animation. State is clamped to a valid range every step so it can't blow up, the seeding is deterministic so a given preset always develops the same way, and the reduced-motion setting renders a single fully developed frame instead of animating.

One lesson worth recording, and not the way you'd first guess: seeding matters. Sprinkle a faint uniform haze of activator across the whole field and it looks reasonable, but in the low-feed regimes it simply decays straight back to the uniform state. Localized strong seeds are what actually nucleate a pattern. Which is itself a small echo of the instability the whole model rests on.

## Where this goes next

The two-chemical square-lattice version is the floor, not the ceiling. The natural extensions read like a research program:

- Three or more morphogens, which unlock patterns the two-species model cannot make, including the sequential striping seen in some development.
- Growth. Real tissue grows while it patterns, and a domain that expands as the reaction runs produces stripe splitting and spot insertion, matching how fish add stripes as they mature.
- Anisotropy and curvature. Patterns on a curved, directionally biased surface differ from patterns on a flat isotropic sheet, which is why the same mechanism can give both stripes and spots on one animal.

## The pattern generalizes

Reaction-diffusion is a general recipe for making structure out of nothing but local rules and two competing rates. The same math turns up in chemistry, in ecology (vegetation stripes in arid landscapes), and in materials science. The lesson for building things is broader still: a startlingly small set of local interactions, iterated, can produce global order that looks designed. Worth internalizing whether you work on biology or on software.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#morphogenesis)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Morphogenesis component and its shaders.

*A demonstration of the mathematics of pattern formation, not a claim about any specific organism's biochemistry.*
