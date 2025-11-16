/**
 * Minimal Tailwind CSS configuration used by the project.
 * Adds the content paths so Tailwind can purge unused styles during build
 * and avoid the "content option is missing or empty" warning.
 */
module.exports = {
	content: [
		'./src/**/*.{js,jsx,ts,tsx,html}',
		'./public/index.html'
	],
	theme: {
		extend: {},
	},
	plugins: [],
}

