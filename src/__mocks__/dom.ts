const domCreate = jest.fn().mockImplementation(({cls, title, text}) => {
  const div = document.createElement("div");
  if (cls) div.className = cls;
  if (title) div.title = title;
  if (text) div.textContent = text;
  div.createDiv = domCreate;
  return div;
});
export {domCreate};