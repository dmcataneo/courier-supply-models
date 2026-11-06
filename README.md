# Courier Supply Models

Hey! This one comes from a question I kept running into in delivery ops: do you book couriers into fixed shifts, or let anyone log in when they feel like it? Both work. They break in different places.

This app simulates one day in a made-up city and compares three ways to put couriers on the road: booked shifts, an open market, and a mix of both. Pick a scene, move the knobs, and see where each model hurts.

It's a small experiment, not a model of any real company or market: fictional city, made-up numbers, simple rules.

It runs in the browser. There is nothing to install: open `index.html`, or serve the folder with any static file server.

[Open the live app](https://dmcataneo.github.io/courier-supply-models/). No login needed.

## Run locally

```bash
# Option 1: open index.html in a browser
# Option 2: serve the folder
python3 -m http.server 8000     # then visit http://localhost:8000
```

## What you can do

- Start from a scene: normal weekday, rain at dinner, slow Tuesday, thin courier pool, sharp peaks, or a forecast that is off.
- Look at one model at a time on the chart: orders per hour (delivered and lost), courier capacity, and delivery time.
- Compare all three side by side on the same day: lost orders, delivery time, cost per order, courier hours, paid-for-nothing hours, and what couriers earn per hour (average and worst hour).
- Change the demand, the forecast error, no-shows, pay, the size of the courier pool and how fast supply reacts. Copy a link to the exact setup: the settings are stored in the URL.

## How it works

**Booked shifts.** A planner books couriers for each hour from a forecast, so they are about 70% busy. Booked couriers get a guaranteed hourly rate, busy or not, and some do not turn up. If the forecast is wrong, nobody can flex.

**Open market.** Couriers come online when their expected earnings per hour beat the lowest pay they would accept. The platform pays per delivered order. The number online is the point where earnings and supply balance (solved by bisection), and it only closes part of the gap each hour, so a sharp peak is not fully covered.

**Hybrid.** A booked base for the share of the plan you choose, with the open market topping up the rest.

**Orders and delivery time.** One courier delivers about 3 orders an hour when fully busy. The busier couriers are, the longer a delivery takes. Past about 40 minutes customers start to give up, up to half of them. This curve is a rule of thumb, not measured data.

Things to keep in mind:

- The numbers are inputs, not findings. Change the pay, the pool or the response speed and the "winner" changes. That is the point of the tool.
- One city, one day, no travel distances, no courier skill differences, no tips, no incentives.
- The planner never sees the surprise window, only the forecast you set.

## Tests

```bash
node --test core.test.js
```

The tests check that the hourly shape adds up and replays with the same seed, that more couriers never means slower delivery, that served orders never exceed demand or capacity, that the open market equilibrium stays in the pool and is a real fixed point, that costs add up, and that the scenes behave as described (a dinner surge hurts booked shifts more than a big open pool, an over-forecast day leaves booked shifts paying for idle time). Node 18 or newer, no dependencies.
