#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// List of files and the changes to make
const fixes = [
  // Remove unused imports in test files
  {
    file: 'src/common/__tests__/realtime-performance-monitor.integration.spec.ts',
    changes: [
      { search: /import\s*\{\s*StandardWebSocketEvent\s*\}\s*from[^;]+;/, replace: '' },
      { search: /\s*let eventEmitter[^;]*;/, replace: '' }
    ]
  },
  {
    file: 'src/common/common.module.ts',
    changes: [
      { search: /,\s*EventEmitter2/, replace: '' }
    ]
  },
  {
    file: 'src/common/controllers/performance-dashboard.controller.ts',
    changes: [
      { search: /,\s*Render/, replace: '' }
    ]
  },
  {
    file: 'src/config/env.validation.ts',
    changes: [
      { search: /,\s*Transform/, replace: '' },
      { search: /,\s*IsEnum/, replace: '' },
      { search: /,\s*IsNumber/, replace: '' },
      { search: /,\s*IsUrl/, replace: '' },
      { search: /,\s*Min/, replace: '' }
    ]
  }
  // Add more fixes as needed
];

fixes.forEach(fix => {
  const filePath = path.join(__dirname, fix.file);
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let changed = false;
    
    fix.changes.forEach(change => {
      const newContent = content.replace(change.search, change.replace);
      if (newContent !== content) {
        content = newContent;
        changed = true;
      }
    });
    
    if (changed) {
      fs.writeFileSync(filePath, content);
      console.log(`Fixed: ${fix.file}`);
    }
  } else {
    console.log(`File not found: ${fix.file}`);
  }
});

console.log('ESLint warning fixes applied');