export const GridContainer = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="w-full flex flex-wrap" {...props} />
);

export const GridItem = (props: React.HTMLAttributes<HTMLDivElement>) => (
  <div className="p-2" {...props} />
);
