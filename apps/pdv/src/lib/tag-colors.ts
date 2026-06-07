function randomChannel() {
  return Math.floor(40 + Math.random() * 176);
}

export function generateRandomTagColor() {
  const red = randomChannel().toString(16).padStart(2, "0");
  const green = randomChannel().toString(16).padStart(2, "0");
  const blue = randomChannel().toString(16).padStart(2, "0");
  return `#${red}${green}${blue}`;
}
