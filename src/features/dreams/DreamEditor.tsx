import { useId, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { ImagePlus, X } from 'lucide-react';
import type { Dream, Goal } from '@/lib/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmojiPickerButton } from '@/components/ui/EmojiPicker';
import { FieldLabel, Input, LABEL, Textarea } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { Chip } from '@/components/ui/Chip';
import { Select } from '@/components/ui/Select';
import { HORIZON_LABEL } from '@/lib/domain/goals';
import { downscaleImage } from './image';
import { categoryLook } from './categories';

const FOCUS = 'focus-ring';
const BASE_CATEGORIES = ['Дело', 'Тело', 'Дом', 'Путешествия', 'Разум'];

export function DreamEditor({
  dream,
  categories,
  goals = [],
  onSave,
  onDelete,
  onClose,
}: {
  dream: Dream | null;
  categories: string[];
  /** Цели, с которыми можно связать мечту. */
  goals?: Goal[];
  onSave: (patch: Pick<Dream, 'title' | 'emoji' | 'description' | 'category' | 'imageDataUrl' | 'goalId'>) => Promise<void> | void;
  onDelete: (dream: Dream) => Promise<void> | void;
  onClose: () => void;
}) {
  const listId = useId();
  const imageLabelId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const confirm = useConfirm();
  const [title, setTitle] = useState(dream?.title ?? '');
  const [emoji, setEmoji] = useState(dream?.emoji);
  const titleId = useId();
  const [description, setDescription] = useState(dream?.description ?? '');
  const [category, setCategory] = useState(dream?.category ?? '');
  const [image, setImage] = useState(dream?.imageDataUrl ?? '');
  const [goalId, setGoalId] = useState(dream?.goalId ?? '');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  // Уже встречавшиеся категории и базовые — быстрый выбор без набора.
  const suggestions = [...new Set([...BASE_CATEGORIES, ...categories])].slice(0, 10);

  const pickImage = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      setImage(await downscaleImage(file));
    } catch {
      toast('Не удалось прочитать картинку', { kind: 'error' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const onDragOver = (e: DragEvent) => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    setDragging(true);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
    void pickImage(file);
  };

  const submit = async () => {
    const t = title.trim();
    if (!t) return;
    await onSave({
      title: t,
      emoji,
      description: description.trim() || undefined,
      category: category.trim() || undefined,
      imageDataUrl: image || undefined,
      goalId: goalId || undefined,
    });
    toast('Сохранено');
    onClose();
  };

  const remove = async () => {
    if (!dream) return;
    if (!(await confirm(`Удалить мечту «${dream.title}»?`))) return;
    await onDelete(dream);
    toast('Мечта удалена');
    onClose();
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={dream ? 'Мечта' : 'Новая мечта'}
      footer={
        <div className="flex w-full items-center gap-2">
          {dream ? (
            <Button variant="danger-quiet" className="mr-auto -ml-2" onClick={() => void remove()}>
              Удалить
            </Button>
          ) : null}
          <Button variant="ghost" onClick={onClose} className={dream ? '' : 'ml-auto'}>
            Отмена
          </Button>
          <Button variant="primary" onClick={() => void submit()} disabled={!title.trim() || busy}>
            Сохранить
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={e => {
          e.preventDefault();
          void submit();
        }}
      >
        <div>
          <FieldLabel htmlFor={titleId}>Название</FieldLabel>
          {/* Эмодзи стоит перед названием на карточке — поэтому он рядом с полем. */}
          <div className="flex items-center gap-2">
            <EmojiPickerButton
              value={emoji}
              onChange={setEmoji}
              size={36}
              label="Эмодзи мечты"
              fallback={(() => {
                const Icon = categoryLook(category).icon;
                return <Icon size={16} aria-hidden="true" />;
              })()}
            />
            <Input id={titleId} autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="О чём мечтаешь" />
          </div>
        </div>

        <div>
          <span className={LABEL}>Категория</span>
          <div role="group" aria-label="Категория" className="flex flex-wrap gap-1.5">
            {suggestions.map(c => {
              const active = category.trim().toLowerCase() === c.toLowerCase();
              return (
                <Chip key={c} selected={active} tone={categoryLook(c).name} onClick={() => setCategory(active ? '' : c)}>
                  {c}
                </Chip>
              );
            })}
          </div>
          <Input
            className="mt-2"
            aria-label="Своя категория"
            list={listId}
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="Или своя: Семья, Творчество…"
          />
          <datalist id={listId}>
            {categories.map(c => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>

        <Textarea
          label="Описание"
          rows={3}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="Зачем это тебе, как выглядит исполнение"
        />

        <div>
          <span id={imageLabelId} className={LABEL}>
            Картинка
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={e => void pickImage(e.target.files?.[0])}
          />
          {image ? (
            <div className="flex items-stretch gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={busy}
                aria-labelledby={imageLabelId}
                aria-describedby={`${imageLabelId}-hint`}
                className={`group relative h-26 w-34 shrink-0 overflow-hidden rounded-tile border border-border bg-fill ${FOCUS}`}
                onDragOver={onDragOver}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
              >
                <img src={image} alt="" className="h-full w-full object-cover" />
                <span
                  aria-hidden="true"
                  className={`absolute inset-0 flex items-center justify-center bg-backdrop text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${
                    dragging ? 'opacity-100' : ''
                  }`}
                >
                  <ImagePlus size={18} />
                </span>
              </button>
              <div className="flex min-w-0 flex-col justify-center gap-1.5">
                <p id={`${imageLabelId}-hint`} className="text-small text-muted">
                  {busy ? 'Обработка…' : 'Нажми на картинку или перетащи новую, чтобы заменить'}
                </p>
                <Button variant="ghost" size="sm" className="-ml-2.5 self-start" onClick={() => setImage('')}>
                  <X size={14} aria-hidden="true" />
                  Убрать картинку
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy}
              aria-labelledby={imageLabelId}
              aria-describedby={`${imageLabelId}-hint`}
              onDragOver={onDragOver}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              className={`flex w-full items-center gap-3 rounded-control border border-dashed px-3 py-3 text-left transition-colors disabled:opacity-60 ${FOCUS} ${
                dragging ? 'border-accent bg-fill' : 'border-border-strong hover:bg-fill'
              }`}
            >
              <ImagePlus size={16} aria-hidden="true" className="shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block text-body font-medium text-text">{busy ? 'Обработка…' : 'Загрузить картинку'}</span>
                <span id={`${imageLabelId}-hint`} className="block text-small text-muted">
                  Или перетащи файл сюда · сожмётся до 800 px
                </span>
              </span>
            </button>
          )}
        </div>

        {goals.length ? (
          <Select label="Цель" value={goalId} onChange={e => setGoalId(e.target.value)}>
            <option value="">Не связана — можно сделать целью на карточке</option>
            {goals.map(g => (
              <option key={g.id} value={g.id}>
                {g.emoji ? `${g.emoji} ` : ''}
                {g.title} · {HORIZON_LABEL[g.horizon]}
              </option>
            ))}
          </Select>
        ) : null}

        <button type="submit" className="sr-only" tabIndex={-1} aria-hidden="true">
          Сохранить
        </button>
      </form>
    </Modal>
  );
}
