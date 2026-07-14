# Nobody Coded a Threshold. The Neuron Fires Anyway. Four Equations From 1952 in the Browser.

*I built a live Hodgkin-Huxley simulator: the four coupled differential equations that explain how a nerve generates a spike, integrated in your browser. Inject current with a slider and watch an action potential fire. Here is the model, the code, and why the threshold is not something I put in.*

## How does a nerve fire?

A neuron signals by briefly flipping the voltage across its membrane. At rest the inside sits about 65 millivolts below the outside. Give it a small nudge and nothing much happens, the voltage leaks back down. Give it a slightly bigger nudge and, past some point, the membrane erupts: the voltage shoots up past zero to positive territory and then slams back down, all in about two milliseconds. That spike, the action potential, is the atom of every thought, sensation, and movement.

In 1952, Alan Hodgkin and Andrew Huxley worked out exactly how, by painstaking experiments on the giant axon of the squid, and wrote it down as a system of differential equations precise enough to predict the spike quantitatively (Hodgkin and Huxley, "A quantitative description of membrane current and its application to conduction and excitation in nerve," Journal of Physiology, 1952). It won the Nobel Prize in 1963 and it is still the foundation of computational neuroscience.

## The four equations

The membrane is a capacitor in parallel with three ionic currents: sodium rushing in, potassium leaking out, and a small passive leak. The voltage changes as injected current charges the capacitor against those currents. What makes it come alive is that the sodium and potassium channels are voltage-gated: their conductance depends on the very voltage they control, through three gating variables. Sodium activates fast (m) but then inactivates (h); potassium activates slowly (n). That is four variables in total, V and m and h and n, each with its own equation.

In code, one step of the system is almost a transcription of the biology:

```javascript
const iNa = G_NA * m * m * m * h * (V - E_NA); // sodium: activates (m^3), inactivates (h)
const iK  = G_K  * n * n * n * n * (V - E_K);  // potassium: activates slowly (n^4)
const iL  = G_L                  * (V - E_L);  // passive leak
const dV  = (I - iNa - iK - iL) / C_M;
const dm  = alphaM(V) * (1 - m) - betaM(V) * m; // each gate chases its
const dh  = alphaH(V) * (1 - h) - betaH(V) * h; // voltage-dependent
const dn  = alphaN(V) * (1 - n) - betaN(V) * n; // open probability
```

The demo integrates this with a forward-Euler step of one hundredth of a millisecond, small enough that the fast sodium spike is captured cleanly, and draws the voltage on an oscilloscope with the gating variables underneath so you can see m jump first, then h fall and n rise to end each spike.

One honest detail: two of Hodgkin and Huxley's original rate functions have a removable zero-over-zero point at specific voltages. Rather than let a division blow up, the code handles those points analytically:

```javascript
// the alpha rates have removable 0/0 singularities; take the limit there
function safeRatio(num, den) { return Math.abs(den) < 1e-7 ? num * 10 : num / den; }
```

## The threshold is emergent, and that is the whole point

Here is the part I find beautiful. Nowhere in the code is there a line that says "if the voltage exceeds threshold, fire a spike." There is no threshold variable, no spike template, no rule that shapes the pulse. The spike, the threshold, the all-or-nothing response, and the refractory pause after each spike all fall out of the four equations on their own.

The mechanism is a race. When voltage rises a little, the fast m gate opens and lets sodium in, which raises the voltage further, which opens more m gates. That positive feedback is an avalanche. Below a critical push the slower brakes, sodium inactivation h and potassium activation n, catch it and the membrane relaxes. Above that push the avalanche wins before the brakes engage, and you get a full spike every time, the same height whether you nudged it just over the line or slammed it. The threshold is simply the tipping point of that feedback, not a number anyone chose.

## Verify, do not vibe

A stiff nonlinear system integrated by hand is exactly where a subtle bug hides, so the model is checked against the physiology it is supposed to reproduce. An automated test drives a fresh copy of the integrator and confirms the behaviors that must hold:

- With no input the membrane rests at minus sixty-five millivolts and never spikes on its own.
- A supra-threshold current produces a spike that overshoots past plus twenty millivolts, measured near plus forty, then repolarizes below rest.
- Firing rate rises with injected current: more current, more spikes per unit time, the real frequency-current relationship.
- A tiny subthreshold current stays silent.
- The integrator stays finite and bounded even when driven hard.

If any of those failed, the model would be wrong in a way a pretty animation would happily hide.

## Where this goes

The single-compartment, deterministic version is the classic. The living extensions are a field:

- Stochastic channels. Real channels are discrete and flip randomly, so small neurons spike a little noisily. Replacing the smooth gating variables with populations of stochastic channels captures that.
- Propagation. A spike does not just happen at a point, it travels down the axon. Coupling many compartments through the cable equation turns this into a wave, which is how signals actually move.
- Reduced models. Two-variable simplifications like FitzHugh-Nagumo keep the excitable dynamics while being easy to analyze on a phase plane, and they reveal that the spike is a general feature of excitable systems, not a quirk of one cell.

## The pattern generalizes

The lesson beyond neuroscience is about emergence. Rich, seemingly rule-like behavior, a threshold, an all-or-nothing pulse, a refractory period, can arise from a handful of simple continuous equations with no rule for any of it written down. Fast positive feedback checked by slower negative feedback is a motif that shows up in genetic switches, chemical oscillators, and control systems. When you see a sharp, decisive, all-or-nothing response in nature, it is worth asking what race of fast and slow processes is producing it.

**Try it live** (the equations run on your device): [rs-03.github.io/demos](https://rs-03.github.io/demos/#neuron)
**Source**: [github.com/rs-03/rs-03.github.io](https://github.com/rs-03/rs-03.github.io). See the Hodgkin-Huxley component and its physiology test.

*A demonstration of the classic Hodgkin-Huxley model, not a full biophysical model of any specific neuron.*
