import { Component, Input, OnInit, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { ReactionService } from '../../../core/services/reaction.service';
import { ReactionEmoji, ReactionSummary } from '../../../core/models/reaction.model';

@Component({
  selector: 'app-reaction-bar',
  standalone: true,
  imports: [AsyncPipe],
  templateUrl: './reaction-bar.component.html',
  styleUrl: './reaction-bar.component.css'
})
export class ReactionBarComponent implements OnInit {
  @Input({ required: true }) predictionId!: string;
  @Input({ required: true }) groupId!: string;

  private reactionService = inject(ReactionService);

  summary$!: Observable<ReactionSummary[]>;

  ngOnInit(): void {
    this.summary$ = this.reactionService.getReactionSummary(this.predictionId);
  }

  async toggle(emoji: ReactionEmoji): Promise<void> {
    await this.reactionService.toggleReaction(this.predictionId, this.groupId, emoji);
  }
}