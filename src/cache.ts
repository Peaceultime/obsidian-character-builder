import { TalentMetadata, RaceMetadata } from 'src/metadata.ts';

export class CharacterBuilderCache {
	static _cache = {};
	static cache(path: string, value: any): any
	{
		if(!!value)
			return CharacterBuilderCache.write_cache(path, value);
		else
			return reach(CharacterBuilderCache._cache, path);
	}
	private static write_cache(path: string, value: string|number): any
	{
		const keys = path.split("/");
		let val = CharacterBuilderCache._cache;
		for(let i = 0; i < keys.length - 1; i++)
		{
			if(val.hasOwnProperty(keys[i]))
				val = val[keys[i]];
			else
				val = val[keys[i]] = {};
		}
		val[keys[keys.length - 1]] = value;

		return value;
	}
}
export function reach(obj: any, path: string): any
{
	const keys = path.split("/");
	for(let i = 0; i < keys.length; i++)
	{
		if(obj.hasOwnProperty(keys[i]))
			obj = obj[keys[i]];
		else
			return undefined;
	}
	return obj;
}

export async function initCache(app: App): void {
	const settings = CharacterBuilderCache.cache("settings");
	const files = app.vault.getMarkdownFiles().reverse();

	const races = (await Promise.all(files.filter(e => e.path.startsWith(settings.racesFolder + "/")).map(async e => new RaceMetadata(e, await app.vault.read(e), app)))).filter(e => !!e && !!e.content);

	const groups = races.reduce((p, v) => { if(!p.includes(v.file.parent.name)) p.push(v.file.parent.name); return p; }, []);

	for(let i = 0; i < groups.length; i++)
		CharacterBuilderCache.cache(`races/${groups[i]}/content`, races.filter(e => e.file.parent.name === groups[i]).reduce((p, v) => { p[v.race.name] = v; return p; }, {}));

	const talents = await Promise.all(files.filter(e => e.path.startsWith(settings.talentsFolder + "/") && !/\d\. /.test(e.basename)).map(async e => new TalentMetadata(e, await app.vault.read(e), app)));
	CharacterBuilderCache.cache("talents", talents.filter(e => e.valid).reduce((p, v) => { p[v.talent.name] = v; return p; }, {}));
}