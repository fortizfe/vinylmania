import { Card } from './ui/Card';

interface UnderConstructionProps {
  title: string;
}

export function UnderConstruction({ title }: UnderConstructionProps) {
  return (
    <Card className="flex flex-col gap-2">
      <h1 className="font-display text-2xl leading-tight text-stone-900 dark:text-stone-100">
        {title}
      </h1>
      <p className="text-stone-500 dark:text-stone-400">
        This section is under construction. Check back soon.
      </p>
    </Card>
  );
}
