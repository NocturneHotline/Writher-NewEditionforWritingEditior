# Writher - Designing Environment as a Medium for Creativity

Writher is an immersive writing platform that rethinks the relationship between environment and cognition.  
It is built on the idea that creative output is not only driven by tools, but by the state of mind shaped through sensory context.

Rather than optimizing for speed or efficiency, Writher focuses on enabling sustained creative flow through atmospheric design.

---

## Live Demo

https://writher-668746766999.us-west1.run.app/

Writher is fully deployed and accessible online.  
No installation is required — users can directly enter the experience through the browser.

---

## Abstract

Most writing tools treat the interface as neutral.  
Writher challenges this assumption.

By integrating real-time environmental rendering into the writing experience, Writher transforms the interface into an active component of cognition - one that influences emotion, attention, and creative depth.

This project explores how digital environments can function as cognitive scaffolding for creativity.

---

## Problem Statement

Writers often struggle with:

- Fragmented attention in overstimulating digital environments  
- Lack of emotional alignment with writing tasks  
- Difficulty entering and maintaining flow state  

Existing tools prioritize functionality, but neglect the psychological conditions required for creation.

---

## Solution

Writher introduces a climate-driven writing system that embeds users in ambient environments designed to regulate mental state.

Instead of removing distractions alone, it replaces them with controlled, meaningful sensory input.

---

## Key Features

### Environmental Rendering Engine

Writher uses WebGL-based shaders to simulate natural phenomena in real time:

- Rain system with dynamic motion and depth perception  
- Snow system with soft particle behavior and spatial layering  

These are not decorative effects — they are designed to influence pacing, mood, and cognitive rhythm.

---

### Immersive Writing Interface

- Minimal, distraction-free layout  
- Full-screen atmospheric integration  
- Seamless interaction between text and environment  

The interface fades into the background, allowing the environment to take cognitive precedence.

---

### Hybrid Visual System (In Progress)

Writher is evolving toward a hybrid rendering model:

- Shader-driven effects  
- User-provided background images  
- Layered composition (image + procedural effects)

This enables users to construct personalized creative spaces.

---

## Technical Architecture

### Frontend

- React  
- TypeScript  

### Rendering Layer

- WebGL + GLSL shaders  
- Real-time fragment shader computation  
- Custom shader container: ShaderCanvas  

### State & Persistence

- LocalStorage for user preferences  
- Modular state management for mood switching  

---

## Engineering Highlights

- Designed a reusable shader container (ShaderCanvas) supporting multiple environmental modes  
- Implemented dynamic background switching with validation constraints  
- Balanced visual fidelity with performance for continuous writing sessions  
- Resolved rendering conflicts between shader effects and image layers  

---

## Roadmap

Writher is positioned as a modular creative environment system.

### Planned Features

- Rainbow mode (dynamic color spectrum rendering)  
- Campfire mode (light flicker and particle simulation)  
- Plant light and shadow system (organic motion patterns)  
- Custom background upload with persistence  
- Environment presets and sharing system  

---

## Design Philosophy

Writher is guided by three principles:

### Environment is not decoration — it is function  
Visual context directly affects cognitive behavior.

### Calm is a prerequisite for depth  
Reducing noise is not enough; meaningful atmosphere must replace it.

### Tools should disappear  
The best interface is one that dissolves into the experience.

---

## Inspiration & Acknowledgements

- Mao (Xiaohongshu) — conceptual inspiration for immersive writing environments  
- baldand (Shadertory) — snow shader reference  
- BigWIngs (Shadertory) — rain shader reference  

---

## Use Case

Writher is designed for:

- Writers seeking deep focus environments  
- Designers exploring atmosphere-driven UX  
- Developers interested in WebGL-based interfaces  

---

## Future Vision

Writher aims to become a platform where users can design and inhabit their own creative environments.

### Long-term Exploration

- Environment-driven UX systems  
- Adaptive interfaces based on user behavior  
- The intersection of cognition, design, and real-time graphics  

---

## License

MIT License
