# Watching Noise Become a Shape: Diffusion Models, Honestly, in the Browser

*I built a 2D diffusion demo that denoises a cloud of pure noise into a target shape, one step at a time, using the exact reverse process behind Stable Diffusion and DALL-E. The one honest simplification is that the denoiser has a closed form here instead of being a giant neural network. The sampling math you watch is identical. Here is how it works and how I checked it.*

## How image generators actually work

Every modern image generator, Stable Diffusion, DALL-E, Imagen, rests on one idea that sounds too simple to work. Take a clean image, add a little Gaussian noise, and repeat until nothing's left but static. That direction is trivial. The hard part is running the film backward: start from static and peel the noise away, step by step, until an image shows up.

The idea goes back further than you'd think. Sohl-Dickstein and colleagues framed generation as reversing a diffusion process in 2015 ("Deep Unsupervised Learning using Nonequilibrium Thermodynamics"), and Ho, Jain, and Abbeel turned it into a method that produces genuinely sharp images in 2020 ("Denoising Diffusion Probabilistic Models," the DDPM paper).

There's a catch. Images live in a space of millions of pixels, and the reverse step needs a huge neural network to estimate, which buries the mechanism under a pile of weights. So I shrank the whole thing down to two dimensions. Each "data point" is just an (x, y) coordinate, and the target is a set of points forming a recognizable shape: the letters AI, a heart, a spiral. Same sampling process, except now it runs smoothly in a browser tab and you can actually watch it converge.

## The reverse process, step by step

A cloud of particles starts as pure Gaussian noise. At each noise level, the demo asks the one question every diffusion model asks: given where this particle sits now, what did the clean data probably look like? The answer is the posterior mean, a weighted average of the possible clean points with nearer ones weighted more heavily. Step toward it, add back a precise, shrinking amount of noise, repeat. That's the DDPM ancestral sampling rule, verbatim:

```javascript
// one exact DDPM reverse step, from noise level t down to t-1
function reverseStep(x, t) {
    // x0hat = E[x0 | xt], the posterior mean over the known target points
    const x0 = posteriorMean(x, t);           // softmax over targets, exact here
    const coefX0 = (Math.sqrt(abar[t - 1]) * beta[t]) / (1 - abar[t]);
    const coefXt = (Math.sqrt(alpha[t]) * (1 - abar[t - 1])) / (1 - abar[t]);
    const mean = coefX0 * x0 + coefXt * x;      // DDPM posterior mean
    const variance = beta[t] * (1 - abar[t - 1]) / (1 - abar[t]);
    return t > 1 ? mean + Math.sqrt(variance) * gaussian() : mean; // last step: no noise
}
```

The noise schedule is the cosine schedule from Nichol and Dhariwal ("Improved Denoising Diffusion Probabilistic Models," 2021), which cools the cloud smoothly from pure static to data. A live readout tracks the cloud's spread, so you're watching it shrink from wide noise to a tight shape rather than trusting a canned animation.

## The score, in closed form here

Here's the one honest simplification, said plainly. Because our target is a fixed, known set of points, the noised distribution at every level is a mixture of Gaussians, and the gradient of its log density (the score, the thing that points toward the data) has a formula. No training required. Song and Ermon showed that diffusion is equivalent to learning this score ("Generative Modeling by Estimating Gradients of the Data Distribution," 2019), and Song and colleagues tied the whole picture together with stochastic differential equations in 2021.

What makes this feel like a cheat, and I mean that in the nicest way, is that the posterior mean is literally a softmax over the known target points. When you already know the data, the score comes for free.

Swap our point cloud for the set of all natural images and that formula evaporates. There's no closed form for "the space of real images." That, and only that, is the job of the giant U-Net inside a real diffusion model: estimate this same score from data. Everything else you watch here, the schedule, the posterior step, the exact amount of noise added back, is unchanged between this toy and a production model. The scale is small. The math is real.

## Verify, don't vibe

An animation that ends on a nice shape proves nothing. A pretty final frame is easy to fake, so I didn't want to trust my eyes. The demo exposes a routine that runs the whole reverse process and reports whether the cloud actually collapsed onto the target. Starting from unit-variance noise, the particle cloud's spread begins near 1.0 and, across every target shape, settles to about 0.62, which matches the spread of the target itself. The mean distance from a particle to its nearest target point ends around 0.015, so the particles land essentially on the shape, and every coordinate stays finite the whole way through. The letters AI resolve out of static. A heart traces itself from noise. The particles land where the equations send them.

## Where the compute goes

This runs smoothly because two dimensions are cheap. Real image diffusion runs the identical reverse process over millions of pixels, calling a large neural network at every one of many steps, which is why it wants a GPU and takes seconds to minutes per image. The demo carries a plain note saying as much. Being honest about the gap between a teaching toy and a production system is the point, not a caveat to bury at the bottom.

## The pattern generalizes

The deeper lesson is that hard generation problems break into easy local steps. Nobody knows how to draw a photorealistic cat in one shot. But almost anyone can make a slightly-less-noisy version of a noisy cat, and chaining thousands of those small, tractable steps composes into something that looks impossible. Turning one intractable leap into many tractable nudges is a pattern that reaches well beyond image generation. It's worth recognizing wherever a problem looks too big to attack head-on.

**Try it live** (nothing leaves your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#diffusion)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Diffusion component and its convergence test.

*A two-dimensional teaching model of denoising diffusion. Real image models learn the score with a large neural network; the sampling process shown here is the same.*
