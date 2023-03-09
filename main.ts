import { App, Editor, WorkspaceLeaf, Plugin } from 'obsidian';

import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { CharacterBuilderSettings as Settings, DEFAULT_SETTINGS, CharacterBuilderSettingTab as SettingTab } from 'src/settings.ts';
import { VIEW_TYPE_CHARACTER_BUILDER_FULL, CharacterBuilderFullView as FullView } from 'src/fullview.ts';

export default class CharacterBuilder extends Plugin {
	settings: Settings;

	loading: Promise<void>;

	async onload(): void {
		await this.loadPluginData();
		if(!this.app.metadataCache.initialized)
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
		this.registerInterval(window.setInterval(() => this.savePluginData(), 5 * 60 * 1000));

		this.app.workspace.onLayoutReady(() => {
			const leaf = this.app.workspace.getLeaf(true);
			this.app.workspace.detachLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL);
			this.loadSavedViews();
			leaf.detach();
		});
	}

	async loadSavedViews() {
		await this.loading;
		for(let i = 0; i < this.savedData.views.length; i++)
		{
			const view = this.savedData.views[i];
			const file = this.app.vault.getAbstractFileByPath(view.path);
			const leaf = this.app.workspace.getLeaf(true);
			await leaf.setViewState({ type: VIEW_TYPE_CHARACTER_BUILDER_FULL, active: view.active });
			if(file)
			{
				leaf.view.file = file;
			}
			leaf.view.metadata = view.metadata;
			leaf.view.refreshRender();
			this.app.workspace.revealLeaf(leaf);
		}
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

		const talents = await Promise.all(files.filter(e => e.path.startsWith(this.settings.talentsFolder + "/") && !/\d\. /.test(e.basename)).map(this.getTalentContent.bind(this)));
		Cache.cache("talents", talents.filter(e => !!e));
	}

	async getRaceContent(file: TFile): any {
		const metadata = app.metadataCache.getFileCache(file);

        if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
            return;

        const content = await this.app.vault.read(this.app.vault.getAbstractFileByPath(file.path));
        const desc = content.substring(metadata.headings[0].position.start.offset, metadata.headings[2].position.start.offset - 1);
        const subraces = metadata.headings.slice(0, metadata.headings.findIndex(e => e.heading.startsWith("BONUS RACIA"))).map((e, i) => i).slice(3).map(e => metadata.headings[e].heading).reduce((p, v) => {
        	p[v] = contentOfHeading(metadata, content, v, true); return p;
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
		const levelRegex = /[Nn]iveau (\d+)/g;
		const metadata = app.metadataCache.getFileCache(file);
		if(!metadata.hasOwnProperty("headings") || !metadata.hasOwnProperty("sections"))
			return;

		const content = await app.vault.read(app.vault.getAbstractFileByPath(file.path));
		const links = /[Pp]r[eé]requis ?:? ? ?:? ?(.+)[\n\,]/g.test(content) ? metadata?.links?.map(e => e.link) : undefined;
		let match, level = Infinity;
		while((match = levelRegex.exec(content)) !== null)
			level = Math.min(level, match[1]);

		const type = /\d\. /.test(file.parent.name) ? undefined : file.parent.name;

		return {filename: file.basename, type: type, options: headingHierarchy(metadata.headings), path: file.path, talentsRequired: links, levelRequired: level === Infinity || type === undefined ? 1 : level, stack: /(?<!non )[Cc]umulable/.test(content) };
	}

	async loadPluginData(): void {
		const data = await this.loadData();

		this.settings = Cache.cache("settings", Object.assign({}, DEFAULT_SETTINGS, data.settings));
		this.savedData = data;
	}

	async savePluginData(): void {
		this.savedData.views = (await this.app.workspace.getLeavesOfType(VIEW_TYPE_CHARACTER_BUILDER_FULL)).map(e => { return { metadata: e.view.metadata, path: e.view.file?.path, active: e === this.app.workspace.activeLeaf }; });
		this.savedData.settings = this.settings;
		await this.saveData(this.savedData);
		await this.initCache();
	}
}
function contentOfHeading(metadata: any, content: string, heading: string, includeHeading: boolean = false)
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
function headingHierarchy(headings)
{
    const hierarchy = [], minLevel = headings.reduce((p, v) => Math.min(p, v.level), 10);
    for(let i = 0; i < headings.length; i++)
    {
        if(headings[i].level === minLevel)
            hierarchy.push(headingChild(headings.slice(i)));
    }
    return hierarchy;
}
function headingChild(headings)
{
    const level = headings[0].level, nextLevel = headings[1]?.level || 0;
    let lastIndex = headings.slice(1).findIndex(e => e.level === level);
    if(lastIndex === -1)
        lastIndex = headings.length;

    const child = headings.slice(1).reduce((p, v, i, a) => { if(i < lastIndex && v.level === nextLevel) p.push(headingChild(a.slice(i))); return p; }, []);
    if(child.length !== 0)
        headings[0].hierarchy = child;
    return headings[0];
}
