const fs = require('fs');
const path = require('path');
const fileP = path.join(__dirname, 'src/index.ts');

let content = fs.readFileSync(fileP, 'utf8');

content = content.replace(/'missions': \['captures'\],/, "'missions': ['miss_obj_stra_act_narrative'],");
content = content.replace(/'axis': \['captures'\],/, "'axis': ['miss_obj_stra_act_narrative'],");

fs.writeFileSync(fileP, content);
console.log("Fixed COUNT_RELATIONS in src/index.ts");
