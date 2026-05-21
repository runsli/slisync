const [major, minor] = process.versions.node.split(".").map(Number);

if (major < 20 || (major === 20 && minor < 9)) {
  console.error(
    `\n[infra] Node ${process.versions.node} is too old. This project requires Node >= 20.9.0.\n` +
      `  nvm use 20   # or: fnm use 20\n` +
      `  node -v      # should print v20.x\n`,
  );
  process.exit(1);
}
