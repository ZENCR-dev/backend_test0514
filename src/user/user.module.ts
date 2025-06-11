import { Module, forwardRef } from "@nestjs/common";
import { UserService } from "./user.service";
import { UserController } from "./user.controller";
import { UserProfileService } from "./services/user-profile.service";
import { UserValidationService } from "./services/user-validation.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [forwardRef(() => AuthModule)],
  providers: [UserService, UserProfileService, UserValidationService],
  controllers: [UserController],
  exports: [UserService, UserProfileService, UserValidationService],
})
export class UserModule {}
