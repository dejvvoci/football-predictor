import { Component, ElementRef, Input, OnChanges, ViewChild, inject, signal } from '@angular/core';
import { AsyncPipe, DatePipe } from '@angular/common';
import { Auth } from '@angular/fire/auth';
import { CommentService } from '../../../../core/services/comment.service';

@Component({
  selector: 'app-group-chat',
  standalone: true,
  imports: [AsyncPipe, DatePipe],
  templateUrl: './group-chat.component.html',
  styleUrl: './group-chat.component.css'
})
export class GroupChatComponent implements OnChanges {
  @Input({ required: true }) groupId!: string;
  @ViewChild('messagesEnd') messagesEnd?: ElementRef;

  private commentService = inject(CommentService);
  private auth = inject(Auth);

  comments$ = this.commentService.getComments(this.groupId);
  myUid = this.auth.currentUser?.uid ?? '';

  text = signal('');
  sending = signal(false);

  ngOnChanges(): void {
    this.comments$ = this.commentService.getComments(this.groupId);
  }

  onInput(event: Event): void {
    this.text.set((event.target as HTMLTextAreaElement).value);
  }

  async send(): Promise<void> {
    const txt = this.text().trim();
    if (!txt || this.sending()) return;

    this.sending.set(true);
    try {
      await this.commentService.addComment(this.groupId, txt);
      this.text.set('');
      setTimeout(() => this.scrollToBottom(), 60);
    } finally {
      this.sending.set(false);
    }
  }

  async deleteComment(id: string): Promise<void> {
    await this.commentService.deleteComment(id);
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
  }
}