# Platform marks

Shared assets are in `public/platform-icons/`: `instagram.png`, `tiktok.png`, `facebook.png`, `linkedin.png`, and `youtube.png`.

Instagram and TikTok use the supplied transparent PNGs. Facebook and LinkedIn backgrounds were cleaned with the built-in imagegen tool using this prompt:

> Edit this supplied platform logo only. Remove all baked white/grey checkerboard background, both outside the logo and in negative-space holes. Preserve the exact logo shape, colors and proportions. Transparent alpha background, no frame, no shadow. Crop canvas closely to the logo with minimal transparent padding. Output a single clean standalone PNG icon.

Generated YouTube cleanup variants introduced a glow and were rejected. `youtube.svg` instead embeds the supplied image within a native SVG clipping path, and `youtube.png` is its rendered counterpart for PowerPoint compatibility.

React, Shortlist, Rate Card, quotation and performance report renderers share these assets. Do not add backgrounds, rings, circular crops or white frames to the platform marks.
