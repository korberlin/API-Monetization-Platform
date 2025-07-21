import { ApiProperty } from '@nestjs/swagger';

export class GrowthMetricsDto {
  @ApiProperty({ example: 1250 })
  thisWeek: number;

  @ApiProperty({ example: 980 })
  lastWeek: number;

  @ApiProperty({
    example: {
      count: 270,
      percentage: 27.55,
      trend: 'up',
    },
  })
  growth: {
    count: number;
    percentage: number;
    trend: 'up' | 'down' | 'stable';
  };
}

export class ErrorRateDto {
  @ApiProperty({ example: 'week' })
  period: string;

  @ApiProperty({ example: 5420 })
  totalRequests: number;

  @ApiProperty({ example: 23 })
  errorRequests: number;

  @ApiProperty({ example: 0.42 })
  errorRate: number;

  @ApiProperty({ example: true })
  isHealthy: boolean;
}

export class TopEndpointDto {
  @ApiProperty({ example: '/api/users' })
  endpoint: string;

  @ApiProperty({ example: 342 })
  requestCount: number;
}

export class DashboardResponseDto {
  @ApiProperty({
    example: {
      today: 342,
      thisWeek: 1250,
      thisMonth: 4875,
    },
  })
  summary: {
    today: number;
    thisWeek: number;
    thisMonth: number;
  };

  @ApiProperty()
  growth: GrowthMetricsDto;

  @ApiProperty()
  errorRate: ErrorRateDto;

  @ApiProperty({ type: [TopEndpointDto] })
  topEndpoints: TopEndpointDto[];

  @ApiProperty({
    example: {
      period: 'hour',
      totalRequests: 342,
      data: [{ timestamp: '2024-01-20T10:00:00.000Z', label: '10:00', count: 15 }],
    },
  })
  hourlyTrend: any;

  @ApiProperty({ example: '2024-01-20T15:30:00.000Z' })
  generatedAt: string;
}
