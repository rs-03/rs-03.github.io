const project = {
    slug: 'hand-keypoint-detection',
    title: 'Real-Time Hand Keypoint Detection',
    shortDescription: 'Live webcam keypoint detection and gesture recognition: 21 landmarks per hand, every frame, entirely on-device. Try it live.',
    fullDescription: `Real-time computer vision running in the browser: 21 hand keypoints tracked per frame with gesture classification (thumbs up, victory, open palm and more), GPU-accelerated via WebAssembly. All inference happens on the visitor's device. No frames are ever uploaded. The same class of keypoint-extraction technique I've applied to utility-infrastructure analysis, where precise landmark detection drives compliance measurements.`,
    category: 'personal',
    sector: 'research',
    type: 'demo',
    status: 'live',
    featured: false,
    techStack: ['MediaPipe', 'Computer Vision', 'WebAssembly', 'WebGL', 'React'],
    highlights: [
        '21 keypoints per hand at ~30 FPS',
        '7-class gesture recognition with confidence scores',
        'GPU-accelerated, fully on-device, privacy by design',
        'Lazy-loaded: model only downloads when the camera starts',
    ],
    demoUrl: '/demos#keypoints',
};

export default project;
