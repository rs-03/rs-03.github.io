# Nobody Coded a Threshold. The Neuron Fires Anyway. Four Equations From 1952 in the Browser.

*I built a live Hodgkin-Huxley simulator: the four coupled differential equations that explain how a nerve generates a spike, integrated in your browser. Inject current with a slider and watch an action potential fire. Here is the model, the code, and why the threshold is not something I put in.*

## How does a nerve fire?

A neuron signals by briefly flipping the voltage across its membrane. At rest, the inside sits about 65 millivolts below the outside. Nudge it a little and not much happens; the voltage just leaks back down. Nudge it a bit harder and, past some point, the membrane erupts. The voltage shoots up past zero into positive territory, then slams back down, the whole thing over in about two milliseconds. That spike is the action potential, and it's the atom of every thought, sensation, and movement.

Back in 1952, Alan Hodgkin and Andrew Huxley worked out exactly how it happens. They did it the hard way, with painstaking experiments on the giant axon of the squid, then wrote the whole thing down as a system of differential equations precise enough to predict the spike quantitatively (Hodgkin and Huxley, "A quantitative description of membrane current and its application to conduction and excitation in nerve," Journal of Physiology, 1952). It won the Nobel Prize in 1963, and it's still the foundation of computational neuroscience. Not bad for a squid.

## The four equations

Picture the membrane as a capacitor in parallel with three ionic currents: sodium rushing in, potassium leaking out, and a small passive leak. Injected current charges the capacitor against those currents, and the voltage moves accordingly. The clever part is that the sodium and potassium channels are voltage-gated. Their conductance depends on the very voltage they control, through three gating variables. Sodium activates fast (m) and then inactivates (h); potassium activates slowly (n). So four variables in all, V and m and h and n, each with its own equation.

Written out in code, a single step is almost a straight transcription of the biology:

```javascript
const iNa = G_NA * m * m * m * h * (V - E_NA); // sodium: activates (m^3), inactivates (h)
const iK  = G_K  * n * n * n * n * (V - E_K);  // potassium: activates slowly (n^4)
const iL  = G_L                  * (V - E_L);  // passive leak
const dV  = (I - iNa - iK - iL) / C_M;
const dm  = alphaM(V) * (1 - m) - betaM(V) * m; // each gate chases its
const dh  = alphaH(V) * (1 - h) - betaH(V) * h; // voltage-dependent
const dn  = alphaN(V) * (1 - n) - betaN(V) * n; // open probability
```

The demo integrates this with a plain forward-Euler step of one hundredth of a millisecond, small enough that the fast sodium spike is captured cleanly. It draws the voltage on an oscilloscope with the gating variables plotted underneath, so you can watch m jump first, then h fall and n rise to shut each spike down.

One honest wrinkle: two of Hodgkin and Huxley's original rate functions have a removable zero-over-zero point at specific voltages. Rather than let a division quietly blow up, the code takes the limit there by hand:

```javascript
// the alpha rates have removable 0/0 singularities; take the limit there
function safeRatio(num, den) { return Math.abs(den) < 1e-7 ? num * 10 : num / den; }
```

## The threshold is emergent, and that is the whole point

Here's the part I find genuinely beautiful. Nowhere in the code is there a line that says "if the voltage exceeds threshold, fire a spike." No threshold variable, no spike template, no rule that shapes the pulse at all. The spike, the threshold, the all-or-nothing response, the refractory pause after each spike: all of it falls out of the four equations on its own.

The mechanism is a race. When the voltage rises a little, the fast m gate opens and lets sodium in, which pushes the voltage higher, which opens more m gates. That positive feedback is an avalanche waiting to happen. Below a critical push, the slower brakes, sodium inactivation h and potassium activation n, catch it in time and the membrane relaxes. Above that push, the avalanche wins before the brakes engage, and you get a full spike every time, the same height whether you nudged it just over the line or slammed it. The threshold is just the tipping point of that feedback. Nobody chose a number.

## Verify, do not vibe

A stiff nonlinear system integrated by hand is exactly the kind of place a subtle bug likes to hide, so the model gets checked against the physiology it's supposed to reproduce. An automated test drives a fresh copy of the integrator and confirms the behaviors that have to hold:

- With no input the membrane rests at minus sixty-five millivolts and never spikes on its own.
- A supra-threshold current produces a spike that overshoots past plus twenty millivolts, measured near plus forty, then repolarizes below rest.
- Firing rate rises with injected current: more current, more spikes per unit time, the real frequency-current relationship.
- A tiny subthreshold current stays silent.
- The integrator stays finite and bounded even when driven hard.

If any of those broke, the model would be wrong in a way that a pretty animation would happily paper over.

## Where this goes

The single-compartment, deterministic version is the classic. The extensions are their own whole field:

- Stochastic channels. Real channels are discrete and flip open and shut at random, so small neurons spike a little noisily. Swap the smooth gating variables for populations of stochastic channels and you capture that.
- Propagation. A spike doesn't just happen at a point, it travels down the axon. Couple many compartments through the cable equation and the whole thing becomes a wave, which is how signals actually move.
- Reduced models. Two-variable simplifications like FitzHugh-Nagumo throw away detail but keep the excitable dynamics, which makes them easy to analyze on a phase plane. They also reveal that the spike is a general feature of excitable systems, not a quirk of one cell.

## The pattern generalizes

The lesson beyond neuroscience is really about emergence. Rich, rule-like behavior (a threshold, an all-or-nothing pulse, a refractory period) can come straight out of a handful of simple continuous equations, with not one of those rules written down anywhere. Fast positive feedback held in check by slower negative feedback is a motif that turns up everywhere: genetic switches, chemical oscillators, control systems. So when you see a sharp, decisive, all-or-nothing response somewhere in nature, it's worth asking what race between fast and slow processes is quietly producing it.

**Try it live** (the equations run on your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#neuron)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Hodgkin-Huxley component and its physiology test.

*A demonstration of the classic Hodgkin-Huxley model, not a full biophysical model of any specific neuron.*
