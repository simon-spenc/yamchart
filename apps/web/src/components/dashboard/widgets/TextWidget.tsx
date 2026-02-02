import ReactMarkdown from 'react-markdown';

interface TextWidgetProps {
  content: string;
}

export function TextWidget({ content }: TextWidgetProps) {
  return (
    <div className="h-full p-4 overflow-auto prose prose-sm max-w-none">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
