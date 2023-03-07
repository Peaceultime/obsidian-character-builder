import { App, Editor, WorkspaceLeaf, Plugin } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { CharacterBuilderSettings as Settings, DEFAULT_SETTINGS, CharacterBuilderSettingTab as SettingTab } from 'src/settings.ts';
import { VIEW_TYPE_CHARACTER_BUILDER_FULL, CharacterBuilderFullView as FullView } from 'src/fullview.ts';

export default class CharacterBuilder extends Plugin {
	settings: Settings;

	loading: Promise<void>;

	async onload(): void {
		await this.loadSettings();
		if(this.app.metadataCache.initialized === false)
		{
			this.loading = new Promise(function(res, rej) {
				this.app.metadataCache.on("resolved", async () => {
					this.app.metadataCache.off("resolved");
					await this.initCache();
					res();
				});
			}.bind(this));
		}
		else
		{
			this.loading = this.initCache();
		}

		this.registerView(
			VIEW_TYPE_CHARACTER_BUILDER_FULL,
			(leaf) => new FullView(leaf, this),
		);

		this.addRibbonIcon('calculator', 'Créer un nouveau personnage', async (evt: MouseEvent) => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true, });
			this.app.workspace.revealLeaf(leaf);
		});

		this.addSettingTab(new SettingTab(this.app, this));

		this.registerEvent(
			this.app.workspace.on("file-menu", (menu, file, source, leaf) => {
				const metadata = this.app.metadataCache.getFileCache(file);
				if(metadata.hasOwnProperty("frontmatter") && metadata.frontmatter.type === "character")
				{
					menu.addSeparator().addItem(item => {
						item.setTitle("Modifier le personnage").setIcon("calculator").onClick(async () => {
							if(!leaf)
								leaf = this.app.workspace.getLeaf(true);
							await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: true });
							await leaf.view.openData(file);
							this.app.workspace.revealLeaf(leaf);
						});
					});
				}
			})
		);

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		//this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
		console.clear();
	}

	async initCache(): void {
		const files = this.app.vault.getMarkdownFiles();

		const races = (await Promise.all(files.filter(e => e.path.startsWith(this.settings.racesFolder + "/")).map(this.getRaceContent.bind(this)))).filter(e => !!e && !!e.content);

		const groups = races.reduce((p, v) => { if(!p.includes(v.parent)) p.push(v.parent); return p; }, []);

		for(let i = 0; i < groups.length; i++)
			Cache.cache(`races/${groups[i]}/content`, races.filter(e => e.parent === groups[i]).reduce((p, v) => { p[v.name] = v; return p; }, {}));

		const talents = files.filter(e => e.path.startsWith(this.settings.talentsFolder + "/")).map(this.getTalentContent.bind(this));
		Cache.cache("talents/metadata", talents.reduce((p, v) => { p[v.name] = v; return p; }, {}));
	}

	async getRaceContent(file: TFile): any {
		const metadata = app.metadataCache.getFileCache(file);

        if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
            return;

        const content = await this.app.vault.read(this.app.vault.getAbstractFileByPath(file.path));
        const desc = content.substring(metadata.headings[0].position.start.offset, metadata.headings[2].position.start.offset - 1);
        const subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"))).map((e, i) => i).slice(3).map(e => metadata.headings[e].heading).reduce((p, v) => {
        	p[v] = this.contentOfHeading(metadata, content, v, true); return p;
        }, {});
        const idx = metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"));
        const start = metadata.headings[idx].position.end.offset, end = idx === metadata.headings.length - 1 ? content.length - 1 : metadata.headings[idx + 1].position.start.offset;
        const features = metadata.sections.reduce((p, v) => { 
        	if(v.position.start.offset >= start && v.position.end.offset <= end) 
        	{
        		const paragraph = content.substring(v.position.start.offset, v.position.end.offset);
        		const match = /\*\*(.+)\*\*/g.exec(paragraph);

        		if(match)
        			p[match[1].replace(/\*/g, "").replace(".", "")] = paragraph;
        	}
        	return p;
        }, {});
        
        return { features: features, subraces: subraces, content: desc, name: file.basename, parent: file.parent.name, path: file.path };
	}

	async getTalentContent(file: TFile): any {

	}

	async loadSettings(): void {
		this.settings = Cache.cache("settings", Object.assign({}, DEFAULT_SETTINGS, await this.loadData()));
	}

	async saveSettings(): void {
		await this.saveData(this.settings);
		await this.initCache();
	}

	contentOfHeading(metadata: any, content: string, heading: string, includeHeading: boolean = false)
	{
		const head = metadata.headings.find(e => e.heading === heading);
		const start = includeHeading ? head.position.start.offset : head.position.end.offset;
		let end;
		
		for(let i = 0; i < metadata.sections.length; i++)
		{
			const sec = metadata.sections[i];
			if(start < sec.position.start.offset && sec.type === "heading")
				break;

			if(start < sec.position.start.offset)
				end = sec.position.end.offset;
		}
		return content.substring(start, end);
	}
}
