import { CharacterBuilderCache as Cache } from 'src/cache.ts';
import { Substats, Stat, StatBlock, StatBlockNames, Metadata, TalentMetadata } from 'src/metadata.ts';
import SubstatsList from 'src/substats.js';

export function print(data: any, template: string): string
{
	const settings = Cache.cache("settings");
	let startStatBlock = JSON.parse(JSON.stringify(data.statBlock));
	return template.replaceAll("{statblock}", statblock(startStatBlock) ?? "")
					.replaceAll("{substatblock}", substats(data.levels.find(e => e.level === 1).buffedSubstats, startStatBlock) ?? "")
					.replaceAll("{armor}", data.armor ?? "")
					.replaceAll("{luck}", data.luck ?? "")
					.replaceAll("{race-name}", `${data.race.name}`)
					.replaceAll("{race-desc}", `![[${settings.racesFolder}/${data.setting}/${data.race.name}#TRAITS GÉNÉRAUX]]\n![[${settings.racesFolder}/${data.setting}/${data.race.name}#BONUS GLOBAUX]]`)
					.replaceAll("{subrace-name}", `${data.race.subname}`)
					.replaceAll("{subrace-desc}", `![[${settings.racesFolder}/${data.setting}/${data.race.name}#${data.race.subname}]]`)
					.replaceAll("{feature-name}", `${data.race.feature}`)
					.replaceAll("{feature-desc}", Cache.cache(`races/${data.setting}/content/${data.race.name}/features/${data.race.feature}`))
					.replaceAll("{flavoring}", data.flavoring ?? "")
					.replaceAll(/\{begin-level\}(.*)\{end-level\}/gs, (d, p1) => {
						let result = "";
						for(let i = 0; i < data.levels.length; i++)
						{
							const text = p1;
							const level = data.levels.find(e => e.level === i + 1);

							const sumValues = data.levels.filter(e => e.level <= i + 1).reduce((p, v) => {
								p.hp += v.hp;
								p.focus += v.focus;

								if(v.buffedStat)
									p.statBlock[v.buffedStat].bonus += 3;

								if(v.buffedSubstats)
								{
									for(const [key, value] of Object.entries(v.buffedSubstats))
									{
										if(!p.buffedSubstats.hasOwnProperty(key))
											p.buffedSubstats[key] = value;
										else
											p.buffedSubstats[key] += value;
									}
								}

								return p;
							}, {statBlock: JSON.parse(JSON.stringify(data.statBlock)), buffedSubstats: {}, hp: Cache.cache(`races/${data.setting}/content/${data.race.name}/health`), focus: 0});

							result += text.replaceAll("{level-nb}", level.level)
									.replaceAll("{level-hp}", `${sumValues.hp} (+${level.hp})`)
									.replaceAll("{level-focus}", `${sumValues.focus} (+${level.focus})`)
									.replaceAll("{level-talents}", level.talents.map(e => `${TalentMetadata.embed(e)}`).join("\n\n"))
									.replaceAll("{level-statblock}", statblock(sumValues.statBlock))
									.replaceAll("{level-substatblock}", substats(sumValues.buffedSubstats, sumValues.statBlock))
									.replaceAll("{level-flavoring}", level.flavoring ?? "")
									.replaceAll("{focus-name}", "Focus");
						}
						return result;
					});
}

function table(header: string[], content: string[][]): string
{
	output = "|";
	for(let i = 0; i < header.length; i++)
	{
		output += `${header[i]}|`;
	}
	output += `\n|`;
	for(let i = 0; i < header.length; i++)
	{
		output += `---|`;
	}
	output += `\n|`;
	for(let i = 0; i < content.length; i++)
	{
		for(let j = 0; j < content[i].length; j++)
		{
			output += `${content[i][j]}|`;
		}
		if(i !== content.length -1)
			output += `\n|`;
	}

	return output;
}
function stat(value: Stat, divider: number = 1): string
{
	return Math.floor(((value.initial + value.bonus) || value) / divider);
}
function statblock(value: StatBlock): string
{
	const header = Object.values(StatBlockNames);
	const content = [[]];
	let i = 0;
	for(const key in value)
	{
		if(!value.hasOwnProperty(key))
			continue;

		content[0][i] = `${value[key].initial + value[key].bonus} (**${value[key].bonus >= 0 ? "+" : ""}${value[key].bonus}**)`;
		i++;
	}
	return table(header, content);
}
function list(value: any[]): string
{
	let content = "";
	for(let i = 0; i < value.length; i++)
		content += `- ${value[i]}\n`;
	return content;
}
function substats(value: Substats, statBlock: StatBlock): string
{
	let content = "";
	const names = Object.keys(value);
	for(let i = 0; i < names.length; i++)
	{
		const s = SubstatsList.find(e => names[i].startsWith(e.name)).stat;
		content += `- **${names[i]}**: +${stat(value[names[i]], 1)} (${stat(value[names[i]] + statBlock[s].initial + statBlock[s].bonus, 1)})\n`;
	}
	return content;
}
