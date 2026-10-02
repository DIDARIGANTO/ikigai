import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { EmojiPicker, EmojiPickerButton } from './EmojiPicker';
import { EMOJI_CATEGORIES, searchEmoji } from './emojiData';

describe('emoji data', () => {
  it('has a curated set of about 150 emoji', () => {
    const unique = new Set(EMOJI_CATEGORIES.flatMap(c => c.items));
    expect(unique.size).toBeGreaterThanOrEqual(140);
  });

  it('searches Russian names by word prefix, ё = е', () => {
    expect(searchEmoji('кофе')).toContain('☕');
    expect(searchEmoji('спо')).toEqual(expect.arrayContaining(['💪', '🏃']));
    expect(searchEmoji('учеба')).toContain('📚');
    expect(searchEmoji('   ')).toEqual([]);
    expect(searchEmoji('абракадабра')).toEqual([]);
  });
});

describe('EmojiPicker', () => {
  it('returns the clicked emoji as a string', () => {
    const onChange = vi.fn();
    render(<EmojiPicker onChange={onChange} autoFocus={false} />);
    fireEvent.click(within(screen.getByRole('tabpanel')).getAllByRole('button')[0]);
    expect(onChange).toHaveBeenCalledWith(EMOJI_CATEGORIES[0].items[0]);
  });

  it('filters by search and Enter picks the first hit', () => {
    const onChange = vi.fn();
    render(<EmojiPicker onChange={onChange} autoFocus={false} />);
    const input = screen.getByRole('textbox', { name: 'Поиск эмодзи' });
    fireEvent.change(input, { target: { value: 'кофе' } });
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'кофе' })).toHaveTextContent('☕');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('☕');
  });

  it('switches categories via tabs', () => {
    render(<EmojiPicker onChange={() => {}} autoFocus={false} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Спорт и здоровье' }));
    expect(within(screen.getByRole('tabpanel')).getByText('🧘')).toBeInTheDocument();
  });

  it('offers to clear the current emoji', () => {
    const onChange = vi.fn();
    render(<EmojiPicker value="🔥" onChange={onChange} autoFocus={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Убрать эмодзи' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('button opens a popover and closes after picking', () => {
    const onChange = vi.fn();
    render(<EmojiPickerButton onChange={onChange} label="Эмодзи задачи" />);
    const trigger = screen.getByRole('button', { name: 'Эмодзи задачи: выбрать' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Выбор эмодзи' });
    fireEvent.click(within(within(dialog).getByRole('tabpanel')).getAllByRole('button')[1]);
    expect(onChange).toHaveBeenCalledWith(EMOJI_CATEGORIES[0].items[1]);
    expect(screen.queryByRole('dialog', { name: 'Выбор эмодзи' })).not.toBeInTheDocument();
  });
});
