const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`公証中: ${appPath}`);

  await notarize({
    tool: 'notarytool',
    appPath,
    keychainProfile: 'nexutha-notarization',
  });

  console.log('公証完了');
};
