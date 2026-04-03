import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
	js.configs.recommended,
	...ts.configs.recommendedTypeChecked,
	...svelte.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node
			},
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		}
	},
	{
		files: ['**/*.svelte', '**/*.svelte.ts'],
		languageOptions: {
			parserOptions: {
				parser: ts.parser
			}
		}
	},
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			// Cloudflare Durable Object bindings are unresolvable by the TS project
			// service (they live in the worker tsconfig). These rules produce false
			// positives throughout src/lib/server and src/routes that interact with DOs.
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			// Svelte event handlers and $effect callbacks commonly fire-and-forget
			// async functions — flagging all of them would require void-operator noise.
			'@typescript-eslint/no-floating-promises': 'off',
			// visibilitychange listeners and similar DOM callbacks fire async functions
			// whose return value is intentionally ignored.
			'@typescript-eslint/no-misused-promises': 'off',
			// async arrow functions used as SvelteKit route handlers sometimes have
			// no await if they delegate synchronously (e.g. proxy to a DO).
			'@typescript-eslint/require-await': 'off',
			// Table rows and static lists with stable identity don't need keys.
			// The rule produces too many false positives on server-rendered data.
			'svelte/require-each-key': 'off',
			// SvelteKit's router handles navigation; resolve() is not needed for
			// simple href="/..." anchors in layout components.
			'svelte/no-navigation-without-resolve': 'off',
			// URLSearchParams usage in admin components is intentional and doesn't
			// need to be replaced with SvelteURLSearchParams.
			'svelte/prefer-svelte-reactivity': 'off',
			// Promise rejections in this codebase sometimes use string literals or
			// re-throw caught errors directly; prefer-promise-reject-errors is too strict.
			'@typescript-eslint/prefer-promise-reject-errors': 'off'
		}
	},
	{
		ignores: [
			'build/',
			'.svelte-kit/',
			'dist-worker/',
			'node_modules/',
			'.wrangler/',
			// Worker and shared files have their own tsconfig and build chain; exclude from SvelteKit linting.
			'worker/',
			'shared/',
			'worker-entry.ts',
			// Config files live outside the SvelteKit tsconfig scope.
			'eslint.config.js',
			'svelte.config.js',
			'playwright.config.ts',
			'scripts/'
		]
	}
);
