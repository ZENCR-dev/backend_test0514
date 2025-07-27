import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "../auth.service";
import { JwtPayload } from "../interfaces/auth.interface";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, "jwt") {
  constructor(
    private readonly configService: ConfigService,
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>("JWT_SECRET"),
    });
  }

  async validate(payload: JwtPayload): Promise<any> {
    const user = await this.authService.verifyPayload(payload);
    if (!user) {
      throw new UnauthorizedException("User not found or account inactive.");
    }

    // 如果是pharmacy_operator，查询关联的药房信息
    let operatedPharmacy = null;
    if (user.role === "pharmacy_operator") {
      operatedPharmacy = await this.prisma.pharmacy.findUnique({
        where: { operatorId: user.id },
        select: { id: true, name: true, status: true },
      });
    }

    // Passport会将这个返回值附加到Request对象上，作为request.user
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      operatedPharmacy: operatedPharmacy,
    };
  }
}
