const fs = require('fs');
const file = 'src/components/LeaderboardTable.tsx';
let content = fs.readFileSync(file, 'utf8');

const target = `{r.laps && r.laps.length > 0 && (
                      <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto">
                        {r.laps.map((lap, i) => (`;

const replacement = `{(() => {
                      const visibleLaps = r.laps?.filter(lap => {
                        const l = lap.label.toUpperCase().trim();
                        return l !== "START" && l !== "FINISH" && l !== "START/FINISH" && l !== "START / FINISH";
                      }) || [];
                      
                      if (visibleLaps.length === 0) return null;
                      
                      return (
                        <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto">
                          {visibleLaps.map((lap, i) => (`;

content = content.replace(target, replacement);

const targetEnd = `                          </div>
                        ))}
                      </div>
                    )}`;

const replacementEnd = `                          </div>
                          ))}
                        </div>
                      );
                    })()}`;

content = content.replace(targetEnd, replacementEnd);

fs.writeFileSync(file, content);
console.log('Patched');
