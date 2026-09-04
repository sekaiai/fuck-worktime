import 'reflect-metadata';

import { BadRequestException, Logger, ValidationPipe } from '@nestjs/common';
import type { ValidationError } from 'class-validator';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  // 全部开放：反射任意来源，允许携带凭据
  app.enableCors({ origin: true, credentials: true });

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      exceptionFactory: (errors: ValidationError[]) =>
        new BadRequestException(errors.flatMap(formatValidationError)),
    }),
  );

  const port = Number(process.env.PORT ?? 10002);
  logger.log(`服务正在监听端口 ${port}`);
  await app.listen(port);
}

const propertyNames: Record<string, string> = {
  userId: '用户标识',
  phone: '手机号',
  taskId: '任务标识',
  projectId: '项目标识',
  projectTitle: '项目名称',
  projectStatus: '项目状态',
  workTypeGroupId: '工时类型分组标识',
  workTypeGroupName: '工时类型分组名称',
  itemId: '工时项目标识',
  itemName: '工时项目名称',
  hours: '工时',
  work: '工作内容',
  reportTime: '填报时间',
  deadline: '截止日期',
  reportDate: '填报日期',
  content: '填报内容',
  workingTimingList: '工时列表',
  endpoint: '订阅地址',
  keys: '订阅密钥',
  p256dh: '公钥',
  auth: '认证密钥',
  days: '天数',
};

function formatValidationError(error: ValidationError): string[] {
  const property = propertyNames[error.property] ?? error.property;
  const messages = Object.keys(error.constraints ?? {}).map((constraint) => {
    switch (constraint) {
      case 'isNotEmpty':
        return `${property}不能为空`;
      case 'isString':
        return `${property}必须是字符串`;
      case 'isNumber':
        return `${property}必须是数字`;
      case 'isBoolean':
        return `${property}必须是布尔值`;
      case 'isInt':
        return `${property}必须是整数`;
      case 'isDateString':
        return `${property}必须是有效的日期格式`;
      case 'isArray':
        return `${property}必须是数组`;
      case 'isObject':
        return `${property}必须是对象`;
      case 'min':
        return `${property}不满足最小值要求`;
      case 'max':
        return `${property}不满足最大值要求`;
      case 'maxLength':
        return `${property}长度超出限制`;
      case 'matches':
        return `${property}格式不正确`;
      case 'whitelistValidation':
        return `${property}包含不允许的字段`;
      default:
        return `${property}格式不正确`;
    }
  });

  return [
    ...messages,
    ...(error.children ?? []).flatMap(formatValidationError),
  ];
}

bootstrap().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('应用启动失败', error);
  process.exit(1);
});
