# Make Belts — Design Ideas

## Design Philosophy Candidates

<response>
<text>
**Idea 1: Industrial Blueprint**

- **Design Movement**: Technical Drawing / Engineering Blueprint
- **Core Principles**: Precision-first, information density, utilitarian clarity, engineering authenticity
- **Color Philosophy**: Off-white (#f8f8f8) background with subtle grid, dark charcoal text (#1a1a2e), blue accent (#2563eb) for interactive elements, amber (#f59e0b) for warnings/highlights. Evokes a drafting table.
- **Layout Paradigm**: Fixed left sidebar (320px) with scrollable controls, full-height canvas workspace on right. Header bar spans full width with tool actions. Mirrors Make-Gears exactly.
- **Signature Elements**: Light dot-grid background on canvas, dashed guide circles on pulleys, dimension annotations directly on canvas
- **Interaction Philosophy**: Every parameter change immediately redraws. Hover reveals computed values. Click-to-select pulleys.
- **Animation**: Smooth pulley rotation with belt traveling animation. Belt teeth visible on timing belts.
- **Typography System**: System UI / -apple-system for controls (compact, readable), monospace for numeric values
</text>
<probability>0.08</probability>
</response>

<response>
<text>
**Idea 2: Dark Engineering Workbench**

- **Design Movement**: Dark mode precision tool / CAD aesthetic
- **Core Principles**: High contrast, dark workspace, glowing accents, professional tool feel
- **Color Philosophy**: Near-black background (#0f1117), dark gray sidebar (#1a1d26), electric blue (#3b82f6) for selected elements, green (#22c55e) for valid states, red (#ef4444) for errors
- **Layout Paradigm**: Same split-panel as Make-Gears but dark themed. Canvas has subtle grid lines in dark gray.
- **Signature Elements**: Glowing pulley outlines, neon-style belt path, floating metric badges
- **Interaction Philosophy**: Hover states glow. Selection pulses. Errors flash red.
- **Animation**: Belt glows as it moves. Rotation indicators on pulley hubs.
- **Typography System**: JetBrains Mono for values, Inter for labels
</text>
<probability>0.06</probability>
</response>

<response>
<text>
**Idea 3: Clean Utilitarian (Match Make-Gears)**

- **Design Movement**: Clean utilitarian engineering tool — exact match to Make-Gears visual language
- **Core Principles**: Functional clarity, information hierarchy, consistent with Make-Gears, professional
- **Color Philosophy**: Light gray (#f8f8f8) canvas background, white sidebar, gray borders (#e2e2e2), blue (#2563eb) for primary actions and selected states, amber for warnings
- **Layout Paradigm**: Left sidebar (320px fixed) with scrollable parameter controls, right canvas workspace. Same NumericField pattern with +/- buttons.
- **Signature Elements**: Dot/line grid on canvas, dashed guide circles, on-canvas dimension labels
- **Interaction Philosophy**: Direct manipulation — click pulley to select, drag to reposition. Immediate recalculation.
- **Animation**: Smooth belt and pulley animation with speed control
- **Typography System**: System UI for controls, monospace for numeric display values
</text>
<probability>0.09</probability>
</response>

## Selected Design: Clean Utilitarian (Match Make-Gears)

Chosen for maximum consistency with the Make-Gears sibling project. The clean utilitarian approach ensures the tool feels like a natural companion to Make-Gears, sharing the same visual language, control patterns, and interaction model. The light background with blue accents provides excellent contrast for the technical canvas drawings.
