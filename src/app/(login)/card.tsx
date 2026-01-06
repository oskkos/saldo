import Image from 'next/image';

import type { ReactElement } from 'react';

export function Card({
  message,
  content,
}: {
  message?: ReactElement;
  content: ReactElement[];
}) {
  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <div className="card-body items-center">
          <div className="card-title">
            <Image
              src="/img/saldo-with-text.png"
              alt="saldo"
              width={128}
              height={64}
              priority={true}
            ></Image>
          </div>
          {message}
          {content.reduce((acc, element, index) => {
            acc.push(element);
            if (index < content.length - 1) {
              acc.push(
                <div
                  key={`content-${index}`}
                  className="divider divider-primary"
                ></div>,
              );
            }
            return acc;
          }, [] as ReactElement[])}
        </div>
      </div>
    </div>
  );
}
