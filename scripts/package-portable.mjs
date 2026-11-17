import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export async function packagePortable({ releaseDir, outputDir, requireLoader = false }) {
  const binary = join(releaseDir, 'persona-companion.exe');
  const bytes = await readFile(binary);
  const pe = bytes.length >= 64 ? bytes.readUInt32LE(0x3c) : -1;
  if (bytes.toString('ascii', 0, 2) !== 'MZ' || pe < 0 || pe + 6 > bytes.length ||
      bytes.toString('ascii', pe, pe + 4) !== 'PE\0\0' || bytes.readUInt16LE(pe + 4) !== 0x8664) {
    throw new Error('O pacote portátil exige um executável Windows x64 válido.');
  }
  const loader = join(releaseDir, 'WebView2Loader.dll');
  const includeLoader = existsSync(loader);
  if (requireLoader && !includeLoader) throw new Error('WebView2Loader.dll ausente para o build GNU.');
  await mkdir(outputDir, { recursive: true });
  // Explicit files only: never copy a checkout, database, preferences, or build directory.
  await copyFile(binary, join(outputDir, 'Persona.exe'));
  const files = ['Persona.exe', 'LEIA-ME.txt'];
  if (includeLoader) {
    await copyFile(loader, join(outputDir, 'WebView2Loader.dll'));
    files.push('WebView2Loader.dll');
  } else {
    await rm(join(outputDir, 'WebView2Loader.dll'), { force: true });
  }
  await writeFile(join(outputDir, 'LEIA-ME.txt'), `PERSONA PARA WINDOWS — SEM INSTALAÇÃO\r\n\r\nExtraia TODOS os arquivos do ZIP para uma pasta pessoal e abra Persona.exe.\r\nNão execute de dentro do ZIP. Mantenha a DLL junto do executável, quando incluída.\r\n\r\nO aplicativo completo inclui o overlay e os alertas. Clique em Hoje na área de trabalho\r\npara mostrar o painel. Arraste pelo cabeçalho; ajuste a opacidade em Ajustes.\r\n\r\nRequer Windows 10/11 x64 e Microsoft Edge WebView2 Runtime já disponível no PC.\r\nEsta versão não instala o WebView2, não cria serviço e não solicita elevação.\r\nSe o runtime faltar ou a política corporativa bloquear o executável, peça apoio à TI.\r\nNão é necessário mudar extensões nem desativar proteções.\r\n\r\nOs dados e preferências continuam na sua pasta de usuário, normalmente em\r\n%APPDATA%\\com.orizon.persona.companion. O banco vinculado fica onde você escolheu.\r\nPara trazer seus dados da PWA, selecione seu JSON em Configurações.\r\nO pacote não contém banco pessoal. Faça backup do JSON.\r\n\r\nSe habilitar Iniciar com o Windows, mantenha esta pasta no mesmo lugar.\r\nAntes de mover ou apagar o aplicativo, desabilite essa opção e saia pela bandeja.\r\nNotificações nativas devem ser conferidas no Windows; a identidade exibida pelo\r\nsistema pode diferir da versão instalada.\r\n`);
  const checksums = await Promise.all(files.map(async name =>
    `${createHash('sha256').update(await readFile(join(outputDir, name))).digest('hex')}  ${name}`));
  await writeFile(join(outputDir, 'SHA256SUMS.txt'), checksums.join('\r\n') + '\r\n');
  return [...files, 'SHA256SUMS.txt'];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  const target = args.length === 0 ? '' : args.length === 2 && args[0] === '--target' ? args[1] : 'invalid';
  if (!['', 'x86_64-pc-windows-msvc', 'x86_64-pc-windows-gnu'].includes(target)) {
    throw new Error('Uso: node scripts/package-portable.mjs [--target x86_64-pc-windows-msvc|x86_64-pc-windows-gnu]');
  }
  const outputDir = join(root, 'companion/src-tauri/target/portable');
  const files = await packagePortable({
    releaseDir: join(root, 'companion/src-tauri/target', target, 'release'),
    outputDir, requireLoader: target.endsWith('-gnu'),
  });
  console.log(`Pacote sem instalação: ${outputDir}\n${files.join('\n')}`);
}
