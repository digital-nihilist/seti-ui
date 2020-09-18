import gulp from 'gulp'
import iconfont from 'gulp-iconfont'
import iconfontCss from 'gulp-iconfont-css'
import svgmin from 'gulp-svgmin'
import fs from 'fs'
import path from 'path'
import { default as mapStream } from 'map-stream'
import { createVSIX } from 'vsce'
import { exec } from 'child_process'
import { clean } from 'gulp-clean'

const fontName = 'seti'

export function update() {
	const inheritIconFromLanguage = {
		jsonc: 'json',
		postcss: 'css',
		'django-html': 'html',
	}

	const font = 'dist/icons/seti.woff',
		fontMappingsFile = 'dist/seti.less',
		fileAssociationFile = './src/styles/components/icons/mapping.less',
		colorsFile = './src/styles/ui-variables.less'

	// list of languagesId not shipped with VSCode. The information is used to associate an icon with a language association
	const nonBuiltInLanguages = {
		// { fileNames, extensions  }
		css: { extensions: ['css'] },
		json: { extensions: ['json'] },
		html: { extensions: ['html'] },

		r: { extensions: ['r', 'rhistory', 'rprofile', 'rt'] },
		argdown: { extensions: ['ad', 'adown', 'argdown', 'argdn'] },
		elm: { extensions: ['elm'] },
		ocaml: { extensions: ['ml', 'mli'] },
		nunjucks: {
			extensions: ['nunjucks', 'nunjs', 'nunj', 'nj', 'njk', 'tmpl', 'tpl'],
		},
		mustache: { extensions: ['mustache', 'mst', 'mu', 'stache'] },
		erb: { extensions: ['erb', 'rhtml', 'html.erb'] },
		terraform: { extensions: ['tf', 'tfvars', 'hcl'] },
		vue: { extensions: ['vue'] },
		sass: { extensions: ['sass'] },
		puppet: { extensions: ['puppet'] },
		kotlin: { extensions: ['kt'] },
		jinja: { extensions: ['jinja'] },
		haxe: { extensions: ['hx'] },
		haskell: { extensions: ['hs'] },
		gradle: { extensions: ['gradle'] },
		elixir: { extensions: ['ex'] },
		haml: { extensions: ['haml'] },
		stylus: { extensions: ['styl'] },
		vala: { extensions: ['vala'] },
		todo: { fileNames: ['todo'] },
	}

	console.log('Reading from ' + fontMappingsFile)

	let def2Content = {}
	let ext2Def = {}
	let fileName2Def = {}
	let def2ColorId = {}
	let colorId2Value = {}
	let lang2Def = {}

	function darkenColor(color) {
		let res = '#'
		for (let i = 1; i < 7; i += 2) {
			let newVal = Math.round(parseInt('0x' + color.substr(i, 2), 16) * 0.9)
			let hex = newVal.toString(16)
			if (hex.length === 1) {
				res += '0'
			}
			res += hex
		}
		return res
	}

	function writeFileIconContent() {
		let iconDefinitions = {}
		let allDefs = Object.keys(def2Content).sort()

		for (let i = 0; i < allDefs.length; i++) {
			let def = allDefs[i]
			let entry = { fontCharacter: def2Content[def] }
			let colorId = def2ColorId[def]
			if (colorId) {
				let colorValue = colorId2Value[colorId]
				if (colorValue) {
					entry.fontColor = colorValue

					let entryInverse = {
						fontCharacter: entry.fontCharacter,
						fontColor: darkenColor(colorValue),
					}
					iconDefinitions[def + '_light'] = entryInverse
				}
			}
			iconDefinitions[def] = entry
		}

		function getInvertSet(input) {
			let result = {}
			for (let assoc in input) {
				let invertDef = input[assoc] + '_light'
				if (iconDefinitions[invertDef]) {
					result[assoc] = invertDef
				}
			}
			return result
		}

		let res = {
			information_for_contributors: [
				'This file has been generated from data in https://github.com/jesseweed/seti-ui',
			],
			fonts: [
				{
					id: 'seti',
					src: [{ path: './seti.woff', format: 'woff' }],
					weight: 'normal',
					style: 'normal',
					size: '150%',
				},
			],
			iconDefinitions: iconDefinitions,
			//	folder: "_folder",
			file: '_default',
			fileExtensions: ext2Def,
			fileNames: fileName2Def,
			languageIds: lang2Def,
			light: {
				file: '_default_light',
				fileExtensions: getInvertSet(ext2Def),
				languageIds: getInvertSet(lang2Def),
				fileNames: getInvertSet(fileName2Def),
			},
			version: '1', //'https://github.com/jesseweed/seti-ui/commit/' + info.commitSha,
		}

		let path = './dist/icons/seti-ui-extended.json'
		fs.writeFileSync(path, JSON.stringify(res, null, '\t'))
		console.log('written ' + path)
	}

	let match

	function readFile(fileName) {
		return new Promise((c, e) => {
			fs.readFile(fileName, function (err, data) {
				if (err) {
					e(err)
				} else {
					c(data.toString())
				}
			})
		})
	}

	function getLanguageMappings() {
		const langMappings = {},
			location = 'C:/Program Files/Microsoft VS Code/resources/app/extensions',
			//location = '..',
			allExtensions = fs.readdirSync(location)
		for (let i = 0; i < allExtensions.length; i++) {
			const dirPath = path.join(location, allExtensions[i], 'package.json')
			if (fs.existsSync(dirPath)) {
				const jsonContent = JSON.parse(fs.readFileSync(dirPath)),
					languages = jsonContent.contributes && jsonContent.contributes.languages

				if (Array.isArray(languages)) {
					for (let k = 0; k < languages.length; k++) {
						const languageId = languages[k].id
						if (languageId) {
							const extensions = languages[k].extensions,
								mapping = {}
							if (Array.isArray(extensions)) {
								mapping.extensions = extensions.map(function (e) {
									return e.substr(1).toLowerCase()
								})
							}

							const filenames = languages[k].filenames
							if (Array.isArray(filenames)) {
								mapping.fileNames = filenames.map(function (f) {
									return f.toLowerCase()
								})
							}
							langMappings[languageId] = mapping
						}
					}
				}
			}
		}

		for (let languageId in nonBuiltInLanguages) {
			langMappings[languageId] = nonBuiltInLanguages[languageId]
		}
		return langMappings
	}

	return readFile(fontMappingsFile).then(function (content) {
		let regex = /@([\w-]+):\s*'(\\E[0-9A-F]+)';/g
		let contents = {}
		while ((match = regex.exec(content)) !== null) {
			contents[match[1]] = match[2]
		}

		return readFile(fileAssociationFile).then(function (content) {
			let regex2 = /\.icon-(?:set|partial)\(['"]([\w-\.]+)['"],\s*['"]([\w-]+)['"],\s*(@[\w-]+)\)/g
			while ((match = regex2.exec(content)) !== null) {
				let pattern = match[1]
				let def = '_' + match[2]
				let colorId = match[3]
				let storedColorId = def2ColorId[def]
				let i = 1
				while (storedColorId && colorId !== storedColorId) {
					// different colors for the same def?
					def = `_${match[2]}_${i}`
					storedColorId = def2ColorId[def]
					i++
				}
				if (!def2ColorId[def]) {
					def2ColorId[def] = colorId
					def2Content[def] = contents[match[2]]
				}

				if (def === '_default') {
					continue // no need to assign default color.
				}
				if (pattern[0] === '.') {
					ext2Def[pattern.substr(1).toLowerCase()] = def
				} else {
					fileName2Def[pattern.toLowerCase()] = def
				}
			}
			// replace extensions for languageId
			let langMappings = getLanguageMappings()
			for (let lang in langMappings) {
				let mappings = langMappings[lang]
				let exts = mappings.extensions || []
				let fileNames = mappings.fileNames || []
				let preferredDef = null
				// use the first file association for the preferred definition
				for (let i1 = 0; i1 < exts.length && !preferredDef; i1++) {
					preferredDef = ext2Def[exts[i1]]
				}
				// use the first file association for the preferred definition
				for (let i1 = 0; i1 < fileNames.length && !preferredDef; i1++) {
					preferredDef = fileName2Def[fileNames[i1]]
				}
				if (preferredDef) {
					lang2Def[lang] = preferredDef
					if (!nonBuiltInLanguages[lang]) {
						for (let i2 = 0; i2 < exts.length; i2++) {
							// remove the extension association, unless it is different from the preferred
							if (ext2Def[exts[i2]] === preferredDef) {
								delete ext2Def[exts[i2]]
							}
						}
						for (let i2 = 0; i2 < fileNames.length; i2++) {
							// remove the fileName association, unless it is different from the preferred
							if (fileName2Def[fileNames[i2]] === preferredDef) {
								delete fileName2Def[fileNames[i2]]
							}
						}
					}
				}
			}
			for (let lang in inheritIconFromLanguage) {
				let superLang = inheritIconFromLanguage[lang]
				let def = lang2Def[superLang]
				if (def) {
					lang2Def[lang] = def
				} else {
					console.log('skipping icon def for ' + lang + ': no icon for ' + superLang + ' defined')
				}
			}

			return readFile(colorsFile).then(function (content) {
				let regex3 = /(@[\w-]+):\s*(#[0-9a-z]+)/g
				while ((match = regex3.exec(content)) !== null) {
					colorId2Value[match[1]] = match[2]
				}
				return writeFileIconContent()
			})
		})
	}, console.error)
}

export function staticComponents() {
	return gulp.src(['src/potato.png']).pipe(gulp.dest('dist/'))
}

export function buildPackage() {
	const pack = {
		name: 'seti-ui-extended',
		private: true,
		displayName: 'Seti UI Extended',
		description: 'A very real description',
		publisher: 'me',
		icon: 'potato.png',
		engines: {
			vscode: '*',
		},
		theme: 'ui',
		contributes: {
			iconThemes: [
				{
					id: 'seti-extended',
					label: 'Seti Extended',
					path: './icons/seti-ui-extended.json',
				},
			],
		},
	}

	return gulp
		.src('package.json')
		.pipe(
			mapStream((file, end) => {
				const basePack = JSON.parse(file.contents)

				const keys = ['name', 'repository', 'version', 'license']

				keys.forEach((key) => (pack[key] = basePack[key]))

				file.contents = Buffer.from(JSON.stringify(pack))
				end(null, file)
			})
		)
		.pipe(gulp.dest('dist/'))
}

export function icons() {
	return gulp
		.src('src/icons/*.svg')
		.pipe(svgmin())
		.pipe(
			iconfontCss({
				fontName: fontName,
				path: 'src/styleTest/_template.less',
				targetPath: '../seti.less',
				fontPath: 'styles/styleTest/seti/',
			})
		)
		.pipe(
			iconfont({
				normalize: true,
				fontHeight: 1000,
				fontName: fontName,
				formats: ['ttf', 'eot', 'woff', 'woff2', 'svg'],
			})
		)
		.pipe(gulp.dest('dist/icons/'))
}

export function vSix(done) {
	createVSIX({
		cwd: './dist/',
	}).then(done)
}

export function cleaner() {
	return gulp.src('dist').pipe(clean())
}

export function install() {
	const vs = fs.readdirSync('dist').find((f) => /\.vsix$/i.test(f))

	return exec(`code --install-extension dist/${vs}`)
	return exec(`cd dist && code --install-extension ${vs}`)
}

export const compile = gulp.parallel(gulp.series(icons, update), buildPackage, staticComponents)

export const build = gulp.series(compile, buildPackage)
