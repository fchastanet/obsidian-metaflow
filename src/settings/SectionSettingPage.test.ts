import {SectionSettingPage} from "./SectionSettingPage";

const createContainerStub = () => {
  const stub = {
    empty: jest.fn(),
    addClass: jest.fn(),
    createEl: jest.fn(),
    createDiv: jest.fn(),
  };
  stub.createDiv.mockReturnValue({child: true});
  return stub;
};

describe('SectionSettingPage', () => {
  test('should set title and render section into a child container', () => {
    const renderer = jest.fn();
    const page = new SectionSettingPage('My page', renderer);
    const container = createContainerStub();
    page.containerEl = container as unknown as HTMLElement;

    page.display();

    expect(page.title).toBe('My page');
    expect(container.empty).toHaveBeenCalled();
    expect(container.addClass).toHaveBeenCalledWith('metaflow-settings-page');
    expect(container.createEl).not.toHaveBeenCalled();
    expect(renderer).toHaveBeenCalledWith({child: true});
  });

  test('should render description when provided', () => {
    const page = new SectionSettingPage('My page', jest.fn(), 'Some description');
    const container = createContainerStub();
    page.containerEl = container as unknown as HTMLElement;

    page.display();

    expect(container.createEl).toHaveBeenCalledWith('p', {text: 'Some description', cls: 'setting-item-description'});
  });

  test('should call onHide callback when page is hidden', () => {
    const onHide = jest.fn();
    const page = new SectionSettingPage('My page', jest.fn(), undefined, onHide);
    page.hide();
    expect(onHide).toHaveBeenCalledTimes(1);
  });
});
