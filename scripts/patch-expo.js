const fs = require('fs');
const path = require('path');

const targetFile = path.join(
  __dirname,
  '..',
  'node_modules',
  'expo-modules-core',
  'android',
  'ExpoModulesCorePlugin.gradle'
);

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  if (content.includes('from components.release')) {
    content = content.replace(
      'from components.release',
      'def comp = components.findByName("release"); if (comp != null) { from comp; }'
    );
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('✅ Successfully patched ExpoModulesCorePlugin.gradle (safeguarded components.release)');
  } else {
    console.log('ℹ️ ExpoModulesCorePlugin.gradle is already patched or does not contain from components.release');
  }
} else {
  console.log('⚠️ ExpoModulesCorePlugin.gradle not found at ' + targetFile);
}
