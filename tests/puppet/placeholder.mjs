// A stand-in atlas (rounded rectangles, no real art) to exercise the puppet engine before the illustrator's parts exist. Used by tests/puppet/demo.mjs only; never shipped.
export const PART_SHAPES = { // name: [w, h, pivot x, pivot y, colour]
  torso: [110, 170, 55, 125, '#1B8A86'], head: [120, 140, 60, 132, '#E8A55B'], tail: [30, 60, 15, 4, '#1B8A86'],
  armNU: [30, 84, 15, 15, '#E8A55B'], armNL: [28, 90, 14, 14, '#E8A55B'], armFU: [30, 84, 15, 15, '#C98B45'], armFL: [28, 90, 14, 14, '#C98B45'],
  legNT: [38, 116, 19, 19, '#E8A55B'], legNS: [34, 110, 17, 17, '#E8A55B'], footN: [78, 36, 20, 18, '#2A9D9A'], legFT: [38, 116, 19, 19, '#C98B45'], legFS: [34, 110, 17, 17, '#C98B45'], footF: [78, 36, 20, 18, '#1F7A78'], shadow: [150, 24, 75, 12, '#5B6770'],
};
export const PLACEHOLDER = (atlas) => ({
  atlas, stage: 512, ground: [256, 470],
  parts: {
    shadow: { rect: null, pivot: [75, 12], parent: null, at: [256, 470], z: -2 },
    torso: { parent: null, at: [256, 247], z: 0 }, head: { parent: 'torso', at: [8, -112], z: 2 }, tail: { parent: 'head', at: [-52, -62], z: -1 },
    armFU: { parent: 'torso', at: [-4, -92], z: -1 }, armFL: { parent: 'armFU', at: [0, 68], z: 0 }, armNU: { parent: 'torso', at: [0, -92], z: 1 }, armNL: { parent: 'armNU', at: [0, 68], z: 0 },
    legFT: { parent: 'torso', at: [-4, 18], z: -1 }, legFS: { parent: 'legFT', at: [0, 96], z: 0 }, footF: { parent: 'legFS', at: [0, 92], z: 0 },
    legNT: { parent: 'torso', at: [0, 18], z: 1 }, legNS: { parent: 'legNT', at: [0, 96], z: 0 }, footN: { parent: 'legNS', at: [0, 92], z: 0 },
  },
});
