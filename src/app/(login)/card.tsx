import Image from 'next/image';

export function Card({
  message,
  content,
}: {
  message?: JSX.Element;
  content: JSX.Element[];
}) {
  return (
    <div className="w-full flex items-center justify-center">
      <div className="card card-bordered bg-base-100 w-96 shadow-xl m-6 mb-12">
        <div className="card-body items-center">
          <div className="card-title">
            <Image
              src="/img/saldo.png"
              alt=""
              width={64}
              height={64}
              priority={true}
            ></Image>
            <span className="text-2xl">saldo</span>
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
          }, [] as JSX.Element[])}
        </div>
      </div>
    </div>
  );
}
