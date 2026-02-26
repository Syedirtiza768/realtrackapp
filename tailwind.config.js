/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            screens: {
                '3xl': '1920px',
            },
            colors: {
                background: '#0f172a', // slate-900
                surface: '#1e293b', // slate-800
                primary: '#3b82f6', // blue-500
                secondary: '#64748b', // slate-500
            },
            keyframes: {
                'slide-in-left': {
                    from: { transform: 'translateX(-100%)' },
                    to: { transform: 'translateX(0)' },
                },
                'slide-out-left': {
                    from: { transform: 'translateX(0)' },
                    to: { transform: 'translateX(-100%)' },
                },
                'fade-in': {
                    from: { opacity: '0' },
                    to: { opacity: '1' },
                },
            },
            animation: {
                'slide-in-left': 'slide-in-left 0.2s ease-out',
                'slide-out-left': 'slide-out-left 0.2s ease-in',
                'fade-in': 'fade-in 0.15s ease-out',
            },
        },
    },
    plugins: [],
}
