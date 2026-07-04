import { Card } from './ui/Card';

interface UnderConstructionProps {
  title: string;
}

export function UnderConstruction({ title }: UnderConstructionProps) {
  return (
    <Card className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{title}</h1>
      <p className="text-gray-500 dark:text-gray-400">
        This section is under construction. Check back soon.
      </p>
    </Card>
  );
}
