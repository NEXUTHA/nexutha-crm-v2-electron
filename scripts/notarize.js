const { notarize } = require('@electron/notarize');

/**
 * electron-builder の afterSign フック。署名済みの .app を Apple に公証(notarize)する。
 *
 * 2通りの認証方式を自動で切り替える:
 *   1) CI(GitHub Actions): 環境変数 APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID
 *      が揃っていれば、それを使って公証する（キーチェーン不要）。
 *   2) ローカル: 上記が無ければ従来どおりキーチェーンプロファイル
 *      'nexutha-notarization' を使う。ローカルの挙動は一切変わらない。
 */
exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;
  if (electronPlatformName !== 'darwin') return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  const appleId = process.env.APPLE_ID;
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const teamId = process.env.APPLE_TEAM_ID;

  if (appleId && appleIdPassword && teamId) {
    // --- CI方式: Apple ID + App用パスワード + Team ID ---
    console.log(`公証中(Apple ID方式): ${appPath}`);
    await notarize({
      tool: 'notarytool',
      appPath,
      appleId,
      appleIdPassword,
      teamId,
    });
  } else {
    // --- ローカル方式: キーチェーンプロファイル（従来どおり） ---
    console.log(`公証中(キーチェーンプロファイル方式): ${appPath}`);
    await notarize({
      tool: 'notarytool',
      appPath,
      keychainProfile: 'nexutha-notarization',
    });
  }

  console.log('公証完了');
};
