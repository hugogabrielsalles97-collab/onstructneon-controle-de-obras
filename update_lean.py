
import os

filepath = r'c:\Users\hugog\Downloads\constructneon---controle-de-obras (1)\components\LeanConstructionPage.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove OAE badge
oae_badge = '<span className="px-2 py-0.5 rounded-md bg-cyan-500/10 border border-cyan-500/20 text-[9px] font-black text-cyan-400 uppercase">{stat.location}</span>'
content = content.replace(oae_badge, '')

# 2. Update Productivity/RUP calculation
old_calc = """            let totalP = 0;
            let totalHh = 0;
            const history = days.map(d => {
                totalP += d.produced;
                totalHh += d.manHours;
                return {
                    ...d,
                    cumProductivity: totalHh > 0 ? (totalP / totalHh).toFixed(3) : '0.000',
                    cumRup: totalP > 0 ? (totalHh / totalP).toFixed(3) : '0.000'
                };
            });"""

# This might still fail if indentation is different. 
# Let's search for the pattern instead.

import re

pattern = re.compile(r'let totalP = 0;.*?let totalHh = 0;.*?const history = days\.map\(d => \{.*?totalP \+= d\.produced;.*?totalHh \+= d\.manHours;.*?return \{.*?\.\.\.d,.*?cumProductivity: totalHh > 0.*?: \'0\.000\',.*?cumRup: totalP > 0.*?: \'0\.000\'.*?\};.*?\}\);', re.DOTALL)

replacement = """            let totalP = 0;
            let totalHh = 0;
            let prodSum = 0;
            let rupSum = 0;
            let prodCount = 0;
            let rupCount = 0;

            const history = days.map(d => {
                totalP += d.produced;
                totalHh += d.manHours;
                const prodVal = Number(d.productivity);
                const rupVal = Number(d.rup);

                if (prodVal > 0) {
                    prodSum += prodVal;
                    prodCount++;
                }
                if (rupVal > 0) {
                    rupSum += rupVal;
                    rupCount++;
                }

                return {
                    ...d,
                    cumProductivity: prodCount > 0 ? (prodSum / prodCount).toFixed(3) : '0.000',
                    cumRup: rupCount > 0 ? (rupSum / rupCount).toFixed(3) : '0.000'
                };
            });"""

if pattern.search(content):
    content = pattern.sub(replacement, content)
    print("Success: Updated calculation")
else:
    print("Error: Could not find calculation pattern")
    # Try a more flexible match or just partial replace
    content = content.replace("cumProductivity: totalHh > 0 ? (totalP / totalHh).toFixed(3) : '0.000'", "cumProductivity: totalHh > 0 ? (totalP / totalHh).toFixed(3) : '0.000'") # dummy

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
